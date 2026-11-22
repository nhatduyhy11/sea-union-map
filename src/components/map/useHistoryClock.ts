import { useEffect, useLayoutEffect, useRef } from "react";
import {
  completeHistorySlot,
  useHistoryPlayback,
} from "../../stores/historyPlayback";

// One clock seeks all visual layers, so pausing freezes routes, icons and progress together.
export function useHistoryClock() {
  const status = useHistoryPlayback((state) => state.status);
  const index = useHistoryPlayback((state) => state.index);
  const duration = useHistoryPlayback((state) => state.duration);
  const frames = useHistoryPlayback((state) => state.frames);
  const samples = useRef<number[]>([]);
  useEffect(() => {
    samples.current = [];
  }, [frames]);
  useLayoutEffect(() => {
    if (status !== "playing" && status !== "paused") return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let elapsed = useHistoryPlayback.getState().elapsed;
    const bindings = new Map<
      HTMLElement | SVGElement,
      { key: string; animation: Animation }
    >();
    // React Flow can mount/update edge paths after its parent graph commits.
    // Bind those late paths at the same elapsed time instead of leaving them static.
    const bind = () => {
      const elements = new Set(
        document.querySelectorAll<HTMLElement | SVGElement>(
          `[data-history-effect][data-history-slot="${index}"]`
        )
      );
      for (const [element, binding] of bindings) {
        if (!elements.has(element)) {
          binding.animation.cancel();
          delete element.dataset.historyBound;
          bindings.delete(element);
        }
      }
      for (const element of elements) {
        const effect = element.dataset.historyEffect;
        const delay = Number(element.dataset.historyDelay ?? 0);
        const effectDuration = Number(element.dataset.historyDuration ?? 450);
        const key = `${effect}/${delay}/${effectDuration}`;
        if (bindings.get(element)?.key === key) continue;
        bindings.get(element)?.animation.cancel();
        const keyframes =
          effect === "route"
            ? [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }]
            : effect === "retreat-route"
              ? [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }]
              : effect === "retreat"
                ? [
                    { clipPath: "circle(250px at 70px 42.5px)", opacity: 1 },
                    { clipPath: "circle(0px at 70px 42.5px)", opacity: 0 },
                  ]
                : effect === "enter"
                  ? [
                      { clipPath: "circle(0px at 70px 42.5px)", opacity: 0 },
                      { clipPath: "circle(250px at 70px 42.5px)", opacity: 1 },
                    ]
                  : [{ opacity: 1 }, { opacity: 0 }];
        const animation = element.animate(keyframes, {
          duration: reduced ? 1 : (effectDuration * duration) / 3000,
          delay: reduced ? duration - 1 : (delay * duration) / 3000,
          fill: "both",
          easing:
            effect === "route" || effect === "retreat-route"
              ? "linear"
              : "ease-in-out",
        });
        animation.pause();
        animation.currentTime = elapsed;
        bindings.set(element, { key, animation });
        element.dataset.historyBound = String(index);
      }
    };
    bind();
    const observer = new MutationObserver(bind);
    const canvas = document.querySelector(".react-flow");
    if (canvas)
      observer.observe(canvas, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
          "data-history-slot",
          "data-history-effect",
          "data-history-delay",
          "data-history-duration",
        ],
      });
    const started = performance.now() - elapsed;
    let raf = 0;
    let last = performance.now();
    const paint = () => {
      for (const { animation } of bindings.values())
        animation.currentTime = elapsed;
      for (const bar of document.querySelectorAll<HTMLElement>(
        "[data-history-progress]"
      )) {
        bar.style.transform = `scaleX(${Math.min(1, elapsed / duration)})`;
        bar.parentElement?.setAttribute(
          "aria-valuenow",
          String(Math.round((elapsed / duration) * 100))
        );
      }
    };
    const tick = (now: number) => {
      samples.current.push(now - last);
      last = now;
      elapsed = Math.min(duration, now - started);
      paint();
      if (elapsed >= duration) {
        if (index === frames.length - 1) {
          const sorted = [...samples.current].sort((a, b) => a - b);
          useHistoryPlayback.setState({
            metrics: {
              p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
              frames: sorted.length,
              slow: sorted.filter((ms) => ms > 33.4).length,
            },
          });
        }
        completeHistorySlot();
      } else raf = requestAnimationFrame(tick);
    };
    paint();
    if (status === "playing") raf = requestAnimationFrame(tick);
    const visibility = () => {
      if (document.hidden && useHistoryPlayback.getState().status === "playing")
        useHistoryPlayback.setState({ status: "paused" });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
      for (const [element, { animation }] of bindings) {
        animation.cancel();
        delete element.dataset.historyBound;
      }
      const state = useHistoryPlayback.getState();
      if (
        state.index === index &&
        state.frames === frames &&
        (state.status === "playing" || state.status === "paused")
      )
        useHistoryPlayback.setState({ elapsed });
    };
  }, [status, index, duration, frames]);
}
