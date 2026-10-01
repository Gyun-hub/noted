import { CACHE_KEYS } from "@/lib/cache-keys";

// 홈 화면 마지막 데이터. 앱을 다시 열면 이걸 먼저 보여주고 뒤에서 최신으로 고침.
// 이 기기 브라우저에만 저장. 날짜가 바뀌면 쓰지 않고, 잠그면 지움.

const KEY = CACHE_KEYS.home;

type Stored<D, W> = { day: string; data?: D; week?: W };

// 같은 탭 안에서 오가는 동안은 메모리로 (localStorage 파싱 생략)
let memory: Stored<unknown, unknown> | null = null;

export function readHomeCache<D, W>(day: string): Stored<D, W> | null {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      memory = null;
    }
  }
  return memory?.day === day ? (memory as Stored<D, W>) : null;
}

export function writeHomeCache<D, W>(day: string, patch: { data?: D; week?: W }) {
  const base = memory?.day === day ? memory : { day };
  memory = { ...base, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 메모리만
  }
}

/** 잠글 때 메모리 사본도 비움 (localStorage는 clearLocalCaches가 지움) */
export function clearHomeMemory() {
  memory = null;
}
