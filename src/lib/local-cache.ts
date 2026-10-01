"use client";

import { useEffect, useRef } from "react";
import { CACHE_KEYS, type CacheKey } from "@/lib/cache-keys";

// 화면 데이터 캐시: 마지막으로 받은 데이터를 먼저 보여주고 뒤에서 최신으로 고침 (stale-while-revalidate).
// scope가 다르면(날짜·달이 바뀌면) 쓰지 않음.

type Entry = { scope: string; value: unknown };

// 같은 탭 안에서 오가는 동안은 메모리로 (localStorage 파싱 생략)
const memory = new Map<CacheKey, Entry | null>();

export function readCache<T>(key: CacheKey, scope = ""): T | null {
  if (!memory.has(key)) {
    try {
      memory.set(key, JSON.parse(localStorage.getItem(key) ?? "null"));
    } catch {
      memory.set(key, null);
    }
  }
  const entry = memory.get(key);
  return entry && entry.scope === scope ? (entry.value as T) : null;
}

export function writeCache<T>(key: CacheKey, value: T, scope = "") {
  const entry = { scope, value };
  memory.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 메모리만
  }
}

/** 잠그기 때 호출. 다른 사람이 같은 기기를 열어도 이전 데이터가 안 보이게 */
export function clearCaches() {
  memory.clear();
  for (const key of Object.values(CACHE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

/**
 * 페이지용. 처음(또는 scope가 바뀌면) 캐시가 있으면 apply로 화면에 채우고,
 * snapshot이 바뀔 때마다 저장. snapshot이 null이면 저장 안 함(아직 이 scope 데이터가 없을 때).
 * 서버에서 최신을 받으면 markFresh()를 불러, 늦게 읽힌 캐시가 최신을 덮지 않게 함.
 */
export function useLocalCache<T>(key: CacheKey, scope: string, snapshot: T | null, apply: (value: T) => void) {
  const fresh = useRef(false);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    fresh.current = false;
    Promise.resolve().then(() => {
      if (fresh.current) return;
      const cached = readCache<T>(key, scope);
      if (cached) applyRef.current(cached);
    });
  }, [key, scope]);

  useEffect(() => {
    if (snapshot !== null) writeCache(key, snapshot, scope);
  }, [key, scope, snapshot]);

  return {
    markFresh() {
      fresh.current = true;
    },
  };
}
