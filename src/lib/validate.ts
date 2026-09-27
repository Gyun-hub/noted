export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 반복 요일 파싱. 0(일)~6(토) 정수 배열.
 * null/빈 배열/7일 전부 = 매일(null). 형식 틀리면 undefined.
 */
export function parseWeekdays(value: unknown): number[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value)) return undefined;
  if (!value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return undefined;
  const days = [...new Set(value as number[])].sort();
  return days.length === 0 || days.length === 7 ? null : days;
}

/** 장보기 구매처. 빈 값 = null(미정), 50자 제한. 형식 틀리면 undefined */
export function parseStore(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const store = value.trim();
  if (store.length > 50) return undefined;
  return store || null;
}
