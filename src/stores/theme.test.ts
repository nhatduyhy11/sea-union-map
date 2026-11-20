import assert from "node:assert/strict";
import { test } from "node:test";

test("system default follows OS changes; explicit choices persist and override OS", async (t) => {
  let stored: string | null = null;
  let storageBlocked = false;
  let onChange: (() => void) | undefined;
  const media = {
    matches: true,
    addEventListener: (_event: string, listener: () => void) => {
      onChange = listener;
    },
  };
  const dataset: { theme?: string } = {};
  let browserColor = "";
  const globals = {
    window: { matchMedia: () => media },
    localStorage: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        if (storageBlocked) throw new Error("Storage unavailable");
        stored = value;
      },
    },
    document: {
      documentElement: { dataset },
      querySelector: () => ({
        setAttribute: (_name: string, value: string) => {
          browserColor = value;
        },
      }),
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }

  const { useTheme } = await import("./theme");
  assert.equal(useTheme.getState().preference, "system");
  assert.equal(dataset.theme, "dark");
  assert.equal(browserColor, "#141e27");

  media.matches = false;
  onChange?.();
  assert.equal(useTheme.getState().theme, "light");
  assert.equal(dataset.theme, "light");
  assert.equal(browserColor, "#eef1f3");

  useTheme.getState().setPreference("dark");
  assert.equal(stored, "dark");
  onChange?.();
  assert.equal(useTheme.getState().theme, "dark");

  useTheme.getState().setPreference("system");
  assert.equal(stored, "system");
  assert.equal(useTheme.getState().theme, "light");
  media.matches = true;
  onChange?.();
  assert.equal(useTheme.getState().theme, "dark");

  storageBlocked = true;
  useTheme.getState().setPreference("light");
  onChange?.();
  assert.equal(useTheme.getState().preference, "light");
  assert.equal(dataset.theme, "light");
});
