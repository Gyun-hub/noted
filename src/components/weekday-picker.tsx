const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 월요일부터 표시
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** null/빈 배열 = 매일 */
export function weekdaysLabel(weekdays: number[] | null | undefined) {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return "매일";
  return ORDER.filter((d) => weekdays.includes(d))
    .map((d) => DAYS[d])
    .join(" ");
}

export function runsOn(weekdays: number[] | null | undefined, day: number) {
  return !weekdays || weekdays.length === 0 || weekdays.includes(day);
}

/** 선택 없음 = 매일 */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  function toggle(day: number) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  }

  const summary =
    value.length === 0 ? "요일을 고르지 않으면 매일 반복" : `${weekdaysLabel(value)} 반복`;

  // 설명 문구는 항상 아랫줄 고정. 같은 줄에 두면 글자 길이에 따라 줄바꿈이 바뀌며 레이아웃이 튐
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-pressed={on}
              aria-label={`${DAYS[d]}요일`}
              className="grid h-8 w-8 place-items-center rounded-full border text-[13px] transition-colors"
              style={
                on
                  ? { background: "var(--blue)", borderColor: "var(--blue)", color: "var(--paper)" }
                  : { color: "var(--pencil)", background: "var(--sheet)" }
              }
            >
              {DAYS[d]}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-pencil" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
