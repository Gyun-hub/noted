import { runsOn } from "@/components/weekday-picker";

export const HISTORY_DAYS = 28;
// 연속 달성일 계산에 쓰는 기간. 이보다 길면 "N+일"로 표시
export const STREAK_WINDOW = 90;

/** "YYYY-MM-DD" 기준 n일 이동 */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

type Props = {
  weekdays: number[] | null;
  createdDate: string;
  today: string;
  isDone: (date: string) => boolean;
};

function stats({ weekdays, createdDate, today, isDone }: Props) {
  const scheduled = (d: string) => d >= createdDate && runsOn(weekdays, weekdayOf(d));

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const d = addDays(today, i - HISTORY_DAYS + 1);
    return { date: d, scheduled: scheduled(d), done: isDone(d) };
  });
  const scheduledDays = days.filter((d) => d.scheduled);
  const doneDays = scheduledDays.filter((d) => d.done).length;

  // 오늘은 아직 안 했어도 끊긴 걸로 치지 않음
  let streak = 0;
  let capped = true;
  for (let i = 0; i < STREAK_WINDOW; i++) {
    const d = addDays(today, -i);
    if (d < createdDate) {
      capped = false;
      break;
    }
    if (!scheduled(d)) continue;
    if (isDone(d)) streak++;
    else if (i > 0) {
      capped = false;
      break;
    }
  }

  return {
    days,
    streak,
    capped: capped && streak > 0,
    rate: scheduledDays.length ? Math.round((doneDays / scheduledDays.length) * 100) : null,
  };
}

export function RecurringHistory(props: Props) {
  const { days, streak, capped, rate } = stats(props);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-[3px]">
        {days.map((d) => (
          <span
            key={d.date}
            title={d.date}
            className="h-2.5 flex-1 rounded-[2px]"
            style={{
              background: !d.scheduled ? "transparent" : d.done ? "var(--accent-2)" : "var(--border-strong)",
              opacity: d.scheduled && !d.done ? 0.35 : 1,
              outline: d.date === props.today ? "1px solid var(--accent-2)" : undefined,
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] text-muted">
        연속 {streak}
        {capped ? "+" : ""}일 · 최근 {HISTORY_DAYS}일 {rate === null ? "-" : `${rate}%`}
      </p>
    </div>
  );
}
