const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 월요일부터 표시
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** null/빈 배열 = 매일 */
export function weekdaysLabel(weekdays: number[] | null | undefined) {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return "매일";
  return ORDER.filter((d) => weekdays.includes(d))
    .map((d) => DAYS[d])
    .join("·");
}

export function runsOn(weekdays: number[] | null | undefined, day: number) {
  return !weekdays || weekdays.length === 0 || weekdays.includes(day);
}

/** 선택 없음 = 매일 */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  function toggle(day: number) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  }

  return (
    <div className="flex items-center gap-1">
      {ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={on}
            className="grid h-7 w-7 place-items-center rounded-full border text-[11px] transition-colors"
            style={
              on
                ? { background: "var(--accent-2-soft)", borderColor: "var(--accent-2)", color: "var(--accent-2)" }
                : { color: "var(--text-muted)" }
            }
          >
            {DAYS[d]}
          </button>
        );
      })}
      <span className="ml-1 font-mono text-[10px] text-muted">{weekdaysLabel(value)}</span>
    </div>
  );
}
