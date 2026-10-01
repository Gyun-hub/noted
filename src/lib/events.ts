// 일정 기간 계산/표시. 서버(API 검증)와 화면 양쪽에서 씀.

export type Repeat = "weekly" | "monthly" | "yearly";

export const REPEAT_LABEL: Record<Repeat, string> = { weekly: "매주", monthly: "매월", yearly: "매년" };

export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  end_date: string | null;
  end_time: string | null;
  repeat?: Repeat | null;
  repeat_until?: string | null;
  /** 반복 일정을 펼친 회차면 원래(첫 회) 날짜. 수정은 이 날짜 기준 */
  series?: { event_date: string; end_date: string | null };
};

export const EVENT_COLUMNS = "id, title, event_date, event_time, end_date, end_time, repeat, repeat_until";

/** "HH:MM:SS" -> "HH:MM" */
export function shortTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : "";
}

export function endDateOf(e: Pick<EventRow, "event_date" | "end_date">) {
  return e.end_date ?? e.event_date;
}

export function isMultiDay(e: Pick<EventRow, "event_date" | "end_date">) {
  return endDateOf(e) > e.event_date;
}

/** "2026-09-27" -> "9월 27일" */
export function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
}

/** 특정 날짜 칸에 보여줄 시간 라벨 */
export function timeLabelOn(e: EventRow, day: string) {
  const start = shortTime(e.event_time);
  const end = shortTime(e.end_time);
  const last = endDateOf(e);

  if (!isMultiDay(e)) {
    if (start && end) return `${start}–${end}`;
    return start || "종일";
  }
  if (day === e.event_date) return start ? `${start}부터` : "시작";
  if (day === last) return end ? `${end}까지` : "마지막 날";
  return "종일";
}

/** 기간 일정 부제: "9월 27일 14:00 ~ 9월 29일 18:00" */
export function rangeLabel(e: EventRow) {
  if (!isMultiDay(e)) return null;
  const start = [monthDay(e.event_date), shortTime(e.event_time)].filter(Boolean).join(" ");
  const end = [monthDay(endDateOf(e)), shortTime(e.end_time)].filter(Boolean).join(" ");
  return `${start} ~ ${end}`;
}

function shiftDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** n개월 뒤. 그 달에 없는 날(31일, 2월 29일)은 말일로 */
function shiftMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

function nthOccurrence(start: string, repeat: Repeat, n: number) {
  if (repeat === "weekly") return shiftDays(start, 7 * n);
  return shiftMonths(start, repeat === "monthly" ? n : 12 * n);
}

/**
 * 반복 일정을 [start, end]와 겹치는 회차들로 펼침. 반복 없는 일정은 그대로.
 * 회차는 event_date/end_date만 옮기고 원래 날짜는 series에 남김.
 */
export function expandEvents(rows: EventRow[], start: string, end: string): EventRow[] {
  const out: EventRow[] = [];
  for (const e of rows) {
    if (!e.repeat) {
      if (e.event_date <= end && endDateOf(e) >= start) out.push(e);
      continue;
    }
    const span = daysBetween(e.event_date, endDateOf(e));
    // 매주는 오래된 일정이 수천 번 돌지 않게 기간 근처로 건너뜀
    let n = e.repeat === "weekly" ? Math.max(0, Math.floor((daysBetween(e.event_date, start) - span) / 7)) : 0;
    for (; ; n++) {
      const date = nthOccurrence(e.event_date, e.repeat, n);
      if (date > end || (e.repeat_until && date > e.repeat_until)) break;
      const last = shiftDays(date, span);
      if (last < start) continue;
      out.push({
        ...e,
        event_date: date,
        end_date: e.end_date ? last : null,
        series: { event_date: e.event_date, end_date: e.end_date },
      });
    }
  }
  return out.sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? "").localeCompare(b.event_time ?? ""),
  );
}

/** 목록 key. 반복 일정은 같은 id가 여러 회차로 나옴 */
export function eventKey(e: EventRow) {
  return `${e.id}|${e.event_date}`;
}

/**
 * 기간 검증. 종료일이 시작일과 같으면 null로 정규화.
 * 문제 있으면 사람이 읽을 에러 문구 반환.
 */
export function normalizeRange(input: {
  eventDate: string;
  eventTime: string | null;
  endDate: string | null;
  endTime: string | null;
}): { ok: true; endDate: string | null } | { ok: false; error: string } {
  const endDate = input.endDate && input.endDate !== input.eventDate ? input.endDate : null;
  if (endDate && endDate < input.eventDate) return { ok: false, error: "종료일이 시작일보다 빨라요" };
  if (!endDate && input.eventTime && input.endTime && input.endTime < input.eventTime) {
    return { ok: false, error: "종료 시간이 시작 시간보다 빨라요" };
  }
  return { ok: true, endDate };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function optionalTime(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && TIME_RE.test(value) ? value.slice(0, 5) : undefined;
}

/** API body의 eventDate/eventTime/endDate/endTime을 DB 컬럼으로. 빈 시간 = null */
export function parseSchedule(body: Record<string, unknown> | null) {
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate : "";
  if (!DATE_RE.test(eventDate)) return { ok: false as const, error: "eventDate invalid" };

  const eventTime = optionalTime(body?.eventTime);
  const endTime = optionalTime(body?.endTime);
  if (eventTime === undefined || endTime === undefined) return { ok: false as const, error: "time invalid" };

  const rawEnd = body?.endDate;
  if (rawEnd !== undefined && rawEnd !== null && rawEnd !== "" && (typeof rawEnd !== "string" || !DATE_RE.test(rawEnd))) {
    return { ok: false as const, error: "endDate invalid" };
  }

  const range = normalizeRange({
    eventDate,
    eventTime,
    endDate: typeof rawEnd === "string" && rawEnd ? rawEnd : null,
    endTime,
  });
  if (!range.ok) return { ok: false as const, error: range.error };

  const repeat = body?.repeat ?? null;
  if (repeat !== null && repeat !== "weekly" && repeat !== "monthly" && repeat !== "yearly") {
    return { ok: false as const, error: "repeat invalid" };
  }
  const rawUntil = repeat ? (body?.repeatUntil ?? null) : null;
  if (rawUntil !== null && rawUntil !== "" && (typeof rawUntil !== "string" || !DATE_RE.test(rawUntil))) {
    return { ok: false as const, error: "repeatUntil invalid" };
  }
  const repeatUntil = typeof rawUntil === "string" && rawUntil ? rawUntil : null;
  const repeatError = checkRepeat({ eventDate, endDate: range.endDate, repeat, repeatUntil });
  if (repeatError) return { ok: false as const, error: repeatError };

  return {
    ok: true as const,
    value: {
      event_date: eventDate,
      event_time: eventTime,
      end_date: range.endDate,
      end_time: endTime,
      repeat: repeat as Repeat | null,
      repeat_until: repeatUntil,
    },
  };
}

const MIN_PERIOD_DAYS: Record<Repeat, number> = { weekly: 7, monthly: 28, yearly: 365 };

/** 반복 검증. 문제 있으면 사람이 읽을 문구 */
export function checkRepeat(input: {
  eventDate: string;
  endDate: string | null;
  repeat: Repeat | null;
  repeatUntil: string | null;
}) {
  if (!input.repeat) return null;
  if (input.repeatUntil && input.repeatUntil < input.eventDate) return "반복 종료일이 시작일보다 빨라요";
  const span = input.endDate ? daysBetween(input.eventDate, input.endDate) : 0;
  if (span >= MIN_PERIOD_DAYS[input.repeat]) return "일정 기간이 반복 주기보다 길어요";
  return null;
}
