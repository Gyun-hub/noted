"use client";

import { normalizeRange } from "@/lib/events";

export type Schedule = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export function emptySchedule(date: string): Schedule {
  return { startDate: date, startTime: "", endDate: date, endTime: "" };
}

/** 화면 입력값 -> API body. 에러 있으면 문구 */
export function scheduleToBody(s: Schedule) {
  const range = normalizeRange({
    eventDate: s.startDate,
    eventTime: s.startTime || null,
    endDate: s.endDate || null,
    endTime: s.endTime || null,
  });
  if (!range.ok) return { error: range.error };
  return {
    body: {
      eventDate: s.startDate,
      eventTime: s.startTime || null,
      endDate: range.endDate,
      endTime: s.endTime || null,
    },
  };
}

/**
 * 시작/종료 날짜·시간 입력. 시간은 비우면 종일.
 * 시작일을 종료일보다 뒤로 옮기면 종료일도 따라감.
 */
export function ScheduleFields({ value, onChange }: { value: Schedule; onChange: (next: Schedule) => void }) {
  const error = scheduleToBody(value).error;

  function set(patch: Partial<Schedule>) {
    const next = { ...value, ...patch };
    if (patch.startDate && next.endDate < patch.startDate) next.endDate = patch.startDate;
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2.5rem_1fr_6.5rem] items-center gap-2">
        <span className="text-[13px] font-medium text-pencil">시작</span>
        <input
          type="date"
          required
          value={value.startDate}
          onChange={(e) => set({ startDate: e.target.value })}
          aria-label="시작일"
          className="field field-sm"
        />
        <input
          type="time"
          value={value.startTime}
          onChange={(e) => set({ startTime: e.target.value })}
          aria-label="시작 시간 (비우면 종일)"
          className="field field-sm"
        />
        <span className="text-[13px] font-medium text-pencil">종료</span>
        <input
          type="date"
          required
          min={value.startDate}
          value={value.endDate}
          onChange={(e) => set({ endDate: e.target.value })}
          aria-label="종료일"
          className="field field-sm"
        />
        <input
          type="time"
          value={value.endTime}
          onChange={(e) => set({ endTime: e.target.value })}
          aria-label="종료 시간 (선택)"
          className="field field-sm"
        />
      </div>
      <p className="text-[12px]" style={{ color: error ? "var(--navy)" : "var(--pencil)" }} role={error ? "alert" : undefined}>
        {error ?? "시간을 비우면 종일 일정이에요"}
      </p>
    </div>
  );
}
