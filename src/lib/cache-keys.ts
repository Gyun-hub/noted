// 이 기기 브라우저(localStorage)에 저장하는 화면 캐시 키 모음.
// 새 캐시를 만들면 여기에 키를 추가. 잠그기(로그아웃) 때 여기 있는 키는 전부 지움 (lib/local-cache.ts)

const PREFIX = "noted:";

export const CACHE_KEYS = {
  /** 홈 요약 카드·목록 (scope: 날짜) */
  home: `${PREFIX}home`,
  /** 홈 이번 주 목록 (scope: 날짜) */
  homeWeek: `${PREFIX}home-week`,
  /** 오늘 화면 (scope: 날짜) */
  today: `${PREFIX}today`,
  /** 달력 마지막으로 본 달 (scope: YYYY-MM) */
  calendar: `${PREFIX}calendar`,
  /** 장보기 목록 */
  products: `${PREFIX}products`,
  /** 아이디어 목록 */
  ideas: `${PREFIX}ideas`,
  /** 옷 기록 목록 */
  clothes: `${PREFIX}clothes`,
  /** 써볼 도구 목록 */
  tools: `${PREFIX}tools`,
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
