"use client";

import { useSyncExternalStore } from "react";
import { isCategory, type Category } from "@/lib/closet";

// 사고 싶은 옷 '구매 후보'. 링크·사진·실측을 같이 담아두고, 살 때 '새 옷 판정'으로 바로 넘겨 봄.
// 서버 표를 새로 만들지 않으려고 기기 브라우저(localStorage)에만 저장한다.
// 기준 사이즈와 같이 잠글 때 지우지 않음 — 지우면 담아둔 후보가 사라져서

export const WISHLIST_STORAGE_KEY = "noted:closet-wishlist";

export type WishlistCandidate = {
  id: string;
  category: Category;
  brand: string;
  name: string;
  price?: number;
  recommendedSize?: string;
  measurements: Record<string, number>;
  productUrl: string;
  imageUrl: string;
  memo: string;
  createdAt: string;
};

/** 화면 입력 → 저장 값 (id·createdAt은 저장할 때 붙임) */
export type WishlistInput = Omit<WishlistCandidate, "id" | "createdAt">;

const SEED_AT = "2026-11-17T03:30:00.000Z";

/**
 * 처음 열었을 때 보여줄 흰티 후보 2종.
 * 실측은 무신사 상품 페이지의 실측표(2XL / 3XL)에서 가져온 값 — 2cm 정도 오차 안내가 있음.
 */
export const DEFAULT_CANDIDATES: WishlistCandidate[] = [
  {
    id: "seed-musinsa-heavyweight-relaxed",
    category: "상의",
    brand: "무신사 스탠다드",
    name: "헤비웨이트 릴렉스드 크루 넥 티셔츠 [화이트]",
    price: 25900,
    recommendedSize: "2XL (세미오버) 또는 3XL (확실한 오버핏)",
    measurements: { 어깨너비: 56, 가슴단면: 64, 총장: 75.2, 소매길이: 27.5 },
    productUrl: "https://www.musinsa.com/products/1841337",
    imageUrl: "https://image.msscdn.net/images/goods_img/20210312/1841337/1841337_2_500.jpg",
    memo:
      "실측은 2XL 기준이에요. 20수 2합 고밀도 헤비웨이트 원단이라 비침과 꼭툭튀가 없어요. 세탁 수축 방지 가공.\n" +
      "총장이 75.2cm로 밑단이 길게 처지지 않아 단독 착용 1순위. 후기 4.9점(2,431개).",
    createdAt: SEED_AT,
  },
  {
    id: "seed-musinsa-relaxed-tee-2",
    category: "상의",
    brand: "무신사 스탠다드",
    name: "릴렉스 핏 크루 넥 티셔츠 2 [화이트]",
    price: 12690,
    recommendedSize: "2XL (가슴 63) 또는 3XL (가슴 65.5)",
    measurements: { 어깨너비: 56, 가슴단면: 63, 총장: 76.3, 소매길이: 27.5 },
    productUrl: "https://www.musinsa.com/products/2474511",
    imageUrl: "https://image.msscdn.net/images/goods_img/20220407/2474511/2474511_17943015793273_500.jpg",
    memo:
      "실측은 2XL 기준이에요. 16수 코튼의 가성비 기본형. 정가 15,900원에서 20% 할인 중이에요.\n" +
      "가볍고 부드러워 셔츠나 자켓 안 이너용으로 좋아요. 후기 4.9점(6,973개).",
    createdAt: SEED_AT,
  },
];

function toNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function newId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `cand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 저장된 값이 이상해도 화면이 깨지지 않게 필요한 항목만 남김 */
function sanitize(raw: unknown): WishlistCandidate[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WishlistCandidate[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Record<string, unknown>;
    if (!isCategory(c.category)) continue;
    const brand = typeof c.brand === "string" ? c.brand.trim() : "";
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!brand && !name) continue;
    const measurements: Record<string, number> = {};
    if (c.measurements && typeof c.measurements === "object") {
      for (const [field, value] of Object.entries(c.measurements as Record<string, unknown>)) {
        const n = toNumber(value);
        if (n !== null) measurements[field] = n;
      }
    }
    out.push({
      id: typeof c.id === "string" && c.id ? c.id : newId(),
      category: c.category,
      brand,
      name,
      price: toNumber(c.price) ?? undefined,
      recommendedSize: typeof c.recommendedSize === "string" ? c.recommendedSize.trim() : "",
      measurements,
      productUrl: typeof c.productUrl === "string" ? c.productUrl.trim() : "",
      imageUrl: typeof c.imageUrl === "string" ? c.imageUrl.trim() : "",
      memo: typeof c.memo === "string" ? c.memo : "",
      createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

/** 담아둔 후보 읽기. 한 번도 저장한 적이 없으면 추천 후보를 보여줌(저장은 하지 않음) */
export function readCandidates(): WishlistCandidate[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
  } catch {
    return DEFAULT_CANDIDATES;
  }
  // 직접 지워서 빈 목록이 된 경우([])에는 추천 후보를 다시 넣지 않음
  if (raw === null) return DEFAULT_CANDIDATES;
  try {
    return sanitize(JSON.parse(raw)) ?? DEFAULT_CANDIDATES;
  } catch {
    return DEFAULT_CANDIDATES;
  }
}

function writeCandidates(candidates: WishlistCandidate[]): boolean {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(candidates));
    return true;
  } catch {
    // 저장 공간이 없거나 막혀 있으면 화면에만 남김
    return false;
  }
}

// localStorage는 React 밖에 있는 값이라 useSyncExternalStore로 읽음.
// 서버에서는 빈 목록, 기기에서는 첫 화면부터 담아둔 후보
const EMPTY: WishlistCandidate[] = [];
let snapshot: WishlistCandidate[] | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): WishlistCandidate[] {
  if (snapshot === null) snapshot = readCandidates();
  return snapshot;
}

function getServerSnapshot(): WishlistCandidate[] {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 저장하면 이 탭도 같이
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== WISHLIST_STORAGE_KEY) return;
    snapshot = readCandidates();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeAndNotify(next: WishlistCandidate[]) {
  if (!writeCandidates(next)) return false;
  snapshot = next;
  listeners.forEach((l) => l());
  return true;
}

/** 담아둔 구매 후보 읽기·쓰기 */
export function useWishlist() {
  const candidates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** 새 후보는 맨 위에 */
  function add(input: WishlistInput) {
    const candidate: WishlistCandidate = { ...input, id: newId(), createdAt: new Date().toISOString() };
    return writeAndNotify([candidate, ...candidates]);
  }

  function update(id: string, input: WishlistInput) {
    if (!candidates.some((c) => c.id === id)) return false;
    return writeAndNotify(candidates.map((c) => (c.id === id ? { ...c, ...input } : c)));
  }

  function remove(id: string) {
    return writeAndNotify(candidates.filter((c) => c.id !== id));
  }

  return { candidates, add, update, remove };
}
