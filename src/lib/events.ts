// 일정 기간 계산/표시. 서버(API 검증)와 화면 양쪽에서 씀.

export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  end_date: string | null;
  end_time: string | null;
};

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

  return {
    ok: true as const,
    value: { event_date: eventDate, event_time: eventTime, end_date: range.endDate, end_time: endTime },
  };
}
