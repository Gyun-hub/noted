"use client";

import { REPEAT_LABEL, checkRepeat, normalizeRange, type Repeat } from "@/lib/events";

export type Schedule = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  repeat: Repeat | "";
  repeatUntil: string;
};

export function emptySchedule(date: string): Schedule {
  return { startDate: date, startTime: "", endDate: date, endTime: "", repeat: "", repeatUntil: "" };
}

const REPEAT_OPTIONS: [Repeat | "", string][] = [
  ["", "안 함"],
  ["weekly", REPEAT_LABEL.weekly],
  ["monthly", REPEAT_LABEL.monthly],
  ["yearly", REPEAT_LABEL.yearly],
];

/** 화면 입력값 -> API body. 에러 있으면 문구 */
export function scheduleToBody(s: Schedule) {
  const range = normalizeRange({
    eventDate: s.startDate,
    eventTime: s.startTime || null,
    endDate: s.endDate || null,
    endTime: s.endTime || null,
  });
  if (!range.ok) return { error: range.error };
  const repeat = s.repeat || null;
  const repeatUntil = repeat ? s.repeatUntil || null : null;
  const repeatError = checkRepeat({ eventDate: s.startDate, endDate: range.endDate, repeat, repeatUntil });
  if (repeatError) return { error: repeatError };
  return {
    body: {
      eventDate: s.startDate,
      eventTime: s.startTime || null,
      endDate: range.endDate,
      endTime: s.endTime || null,
      repeat,
      repeatUntil,
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="w-10 text-[13px] font-medium text-pencil">반복</span>
        {REPEAT_OPTIONS.map(([option, label]) => (
          <button
            key={option || "none"}
            type="button"
            onClick={() => set({ repeat: option })}
            aria-pressed={value.repeat === option}
            className="chip"
          >
            {label}
          </button>
        ))}
      </div>
      {value.repeat && (
        <div className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
          <span className="text-[13px] font-medium text-pencil">까지</span>
          <input
            type="date"
            min={value.startDate}
            value={value.repeatUntil}
            onChange={(e) => set({ repeatUntil: e.target.value })}
            aria-label="반복 종료일 (비우면 계속)"
            className="field field-sm"
          />
        </div>
      )}
      <p className="text-[12px]" style={{ color: error ? "var(--navy)" : "var(--pencil)" }} role={error ? "alert" : undefined}>
        {error ??
          (value.repeat
            ? `${REPEAT_LABEL[value.repeat]} 반복${value.repeatUntil ? "" : " · 종료일을 비우면 계속"}`
            : "시간을 비우면 종일 일정이에요")}
      </p>
    </div>
  );
}
