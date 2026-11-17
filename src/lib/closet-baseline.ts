"use client";

import { useSyncExternalStore } from "react";
import { isCategory, type Category } from "@/lib/closet";

// 카테고리별 '내 기준 사이즈'. 새 옷이 맞을지 볼 때 비교 기준으로 쓰는 값.
// 서버 표를 새로 만들지 않으려고 기기 브라우저(localStorage)에만 저장한다.
// 화면 캐시(cache-keys.ts)와 달리 잠글 때 지우지 않음 — 지우면 직접 적어둔 값을 다시 넣어야 해서

export const BASELINE_STORAGE_KEY = "noted:closet-baseline";

/** { 상의: { 어깨너비: 62, 가슴단면: 64, ... } } — 비운 항목은 담지 않음 */
export type Baselines = Partial<Record<Category, Record<string, number>>>;

/** 저장된 값이 이상해도 화면이 깨지지 않게 숫자·카테고리만 남김 */
function sanitize(raw: unknown): Baselines {
  if (!raw || typeof raw !== "object") return {};
  const out: Baselines = {};
  for (const [category, fields] of Object.entries(raw as Record<string, unknown>)) {
    if (!isCategory(category) || !fields || typeof fields !== "object") continue;
    const values: Record<string, number> = {};
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) continue;
      values[field] = Math.round(n * 10) / 10;
    }
    if (Object.keys(values).length > 0) out[category] = values;
  }
  return out;
}

export function readBaselines(): Baselines {
  try {
    return sanitize(JSON.parse(localStorage.getItem(BASELINE_STORAGE_KEY) ?? "null"));
  } catch {
    return {};
  }
}

export function writeBaselines(baselines: Baselines): boolean {
  try {
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baselines));
    return true;
  } catch {
    // 저장 공간이 없거나 막혀 있으면 화면에만 남김
    return false;
  }
}

// localStorage는 React 밖에 있는 값이라 useSyncExternalStore로 읽음.
// 서버에서는 빈 값, 기기에서는 첫 화면부터 저장된 값(useEffect로 늦게 채우지 않음)
const EMPTY: Baselines = {};
let snapshot: Baselines | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Baselines {
  if (snapshot === null) snapshot = readBaselines();
  return snapshot;
}

function getServerSnapshot(): Baselines {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 저장하면 이 탭도 같이
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== BASELINE_STORAGE_KEY) return;
    snapshot = readBaselines();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeAndNotify(next: Baselines) {
  if (!writeBaselines(next)) return false;
  snapshot = next;
  listeners.forEach((l) => l());
  return true;
}

/** 저장한 기준 사이즈 읽기·쓰기 */
export function useBaselines() {
  const baselines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** 한 카테고리만 바꿈. 넘긴 값이 비면 그 카테고리 기준은 지움 */
  function saveCategory(category: Category, values: Record<string, number>) {
    const next = { ...baselines };
    if (Object.keys(values).length > 0) next[category] = values;
    else delete next[category];
    return writeAndNotify(next);
  }

  return { baselines, saveCategory };
}
