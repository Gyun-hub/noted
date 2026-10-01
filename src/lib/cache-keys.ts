// 이 기기 브라우저(localStorage)에 저장하는 캐시 키 모음.
// 새 캐시를 만들면 여기에 키를 추가. 잠그기(로그아웃) 때 여기 있는 키는 전부 지움.

const PREFIX = "noted:";

export const CACHE_KEYS = {
  /** 홈 화면 마지막 데이터 (lib/home-cache.ts) */
  home: `${PREFIX}home`,
} as const;

/** 잠그기 때 호출. 다른 사람이 같은 기기를 열어도 이전 데이터가 안 보이게 */
export function clearLocalCaches() {
  for (const key of Object.values(CACHE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}
