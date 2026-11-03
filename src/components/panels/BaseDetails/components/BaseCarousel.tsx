import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Castle, ChevronLeft, ChevronRight } from "lucide-react";
import { factionRing } from "../../../../data/factions";
import { rankFactions } from "../../../../domain/selectors";
import { useFitMap } from "../../../../hooks/useFitMap";
import { useMapData } from "../../../../stores/dataset";
import { roman } from "../../../../utils/format";
import { useSelection } from "../../../../stores/selection";
import { getFactionIcon } from "../../../shared/faction/factionIcons";
import styles from "./BaseCarousel.module.css";

// Khớp --tile + --gap trong BaseCarousel.module.css: khoảng cách hai ô.
const STEP = 66 + 12;
// Kéo quá ngưỡng này (px) là chuyển ít nhất một căn cứ.
const SWIPE_THRESHOLD = 30;
const DURATION = 260;
// Zoom ra toàn canvas khi đổi phe — cùng nhịp với focus đảo.
const FIT_DURATION = 500;
// Ô xa tâm hơn chừng này (đơn vị ô) nằm ngoài viewport → không render.
const VISIBLE = 2.5;

const N = factionRing.length;
const wrap = (k: number) => ((k % N) + N) % N;
const ringIndex = (factionId: string) =>
  Math.max(
    0,
    factionRing.findIndex((faction) => faction.id === factionId)
  );
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// Vòng căn cứ vô tận: vị trí `pos` là số thực không giới hạn, ô thứ k (số
// nguyên bất kỳ) hiện phe factionRing[k mod N] tại (k - pos) × STEP. Chỉ render
// các ô gần tâm, nên không cần clone hai đầu và không có bước reset vị trí.
// Chuyển bằng mũi tên, bấm icon bên cạnh, phím ←/→ hoặc kéo ngang.
export function BaseCarousel({ factionId }: { factionId: string }) {
  const open = useSelection((state) => state.open);
  const fitMap = useFitMap(FIT_DURATION);
  // Hạng theo điểm phe ở góc mỗi ô — chỉ xếp phe đã có điểm; chưa có điểm
  // (event chưa bắt đầu) thì không hiện số thay vì hạng 1..N tuỳ ý.
  const { factionBoard } = useMapData();
  const ranks = useMemo(
    () => rankFactions(factionBoard.filter((entry) => entry.score > 0)),
    [factionBoard]
  );
  // Đọc trong rAF (closure cũ) nên giữ bản mới nhất qua ref.
  const factionRef = useRef(factionId);
  factionRef.current = factionId;
  const [pos, setPos] = useState(() => ringIndex(factionId));
  const posRef = useRef(pos);
  // Ô đích đang trượt tới (số nguyên) — bấm liên tiếp cộng dồn vào đây.
  const targetRef = useRef(pos);
  const frame = useRef(0);
  const drag = useRef<{
    x: number;
    from: number;
    pointer: number;
    moved: boolean;
  } | null>(null);

  const move = (value: number) => {
    posRef.current = value;
    setPos(value);
  };
  const stop = () => cancelAnimationFrame(frame.current);

  const animateTo = (target: number) => {
    stop();
    targetRef.current = target;
    const start = posRef.current;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / DURATION);
      move(start + (target - start) * easeOutCubic(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        const id = factionRing[wrap(target)]!.id;
        // Đổi phe từ carousel → mở căn cứ mới + zoom mượt ra toàn canvas. Trượt theo
        // căn cứ đổi từ ngoài thì id đã khớp, không đụng camera.
        if (id !== factionRef.current) {
          open(`base-${id}`);
          fitMap();
        }
      }
    };
    frame.current = requestAnimationFrame(tick);
  };
  const step = (delta: number) => animateTo(targetRef.current + delta);

  // Căn cứ đổi từ ngoài (bấm trên map) → trượt theo đường ngắn nhất tới đó.
  useEffect(() => {
    const current = targetRef.current;
    let delta = wrap(ringIndex(factionId) - current);
    if (delta === 0) return;
    if (delta > N / 2) delta -= N;
    animateTo(current + delta);
  }, [factionId]);
  useEffect(() => stop, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      from: posRef.current,
      pointer: event.pointerId,
      moved: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    // Chỉ chiếm pointer khi đã kéo thật — để click icon bên cạnh vẫn chạy.
    if (!state.moved && Math.abs(dx) > 4) {
      state.moved = true;
      stop();
      event.currentTarget.setPointerCapture(state.pointer);
    }
    if (state.moved) move(state.from - dx / STEP);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    const dx = event.clientX - state.x;
    let target = Math.round(posRef.current);
    // Kéo qua ngưỡng mà chưa tới nửa ô vẫn tính là sang ô kế.
    const origin = Math.round(state.from);
    if (target === origin && Math.abs(dx) >= SWIPE_THRESHOLD)
      target = origin - Math.sign(dx);
    animateTo(target);
  };

  const first = Math.ceil(pos - VISIBLE);
  const tiles = Array.from(
    { length: Math.floor(pos + VISIBLE) - first + 1 },
    (_, i) => first + i
  );
  const centerFaction = factionRing[wrap(Math.round(pos))]!;
  const near = (delta: number) => factionRing[wrap(targetRef.current + delta)]!;

  return (
    <div
      className={styles.carousel}
      role="group"
      aria-label={`Chuyển căn cứ phe — đang xem ${centerFaction.name}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") step(-1);
        else if (event.key === "ArrowRight") step(1);
      }}
    >
      <button
        className={styles.arrow}
        aria-label={`Căn cứ trước: ${near(-1).name}`}
        onClick={() => step(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <div
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {tiles.map((k) => {
          const faction = factionRing[wrap(k)]!;
          const Icon = getFactionIcon(faction.id) ?? Castle;
          const distance = Math.min(1, Math.abs(k - pos));
          const isCenter = Math.round(pos) === k;
          const rank = ranks.get(faction.id);
          return (
            <button
              key={k}
              className={`${styles.tile} ${isCenter ? styles.current : ""}`}
              style={{
                color: faction.color,
                opacity: 1 - distance * 0.55,
                transform: `translateX(${(k - pos) * STEP}px) scale(${1 - distance * 0.08})`,
              }}
              title={faction.name}
              tabIndex={-1}
              aria-hidden={isCenter ? undefined : true}
              onClick={() => !isCenter && animateTo(k)}
            >
              <Icon size={33} />
              {rank && (
                <span className={styles.rank} aria-label={`Hạng ${rank}`}>
                  {roman(rank)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        className={styles.arrow}
        aria-label={`Căn cứ sau: ${near(1).name}`}
        onClick={() => step(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
