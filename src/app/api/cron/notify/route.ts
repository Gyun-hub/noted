import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthDay, rangeLabel, timeLabelOn, type EventRow } from "@/lib/events";
import { kstNow, sendToAll } from "@/lib/push";
import { timingSafeEqual } from "@/lib/session";

// 설정 시각 이후 이 시간 안에만 발송. Cron이 몇 번 밀려도 잡히고,
// 한참 뒤에 추가한 일정이 밤에 갑자기 알림으로 오진 않게.
const SEND_WINDOW_MIN = 60;

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function weekdayOf(date: string) {
  return "일월화수목금토"[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function headline(daysBefore: number, date: string, count: number) {
  if (daysBefore === 0) return `오늘 일정 ${count}개`;
  if (daysBefore === 1) return `내일 일정 ${count}개`;
  return `${daysBefore}일 뒤 ${monthDay(date)}(${weekdayOf(date)}) 일정 ${count}개`;
}

function line(e: EventRow) {
  const range = rangeLabel(e);
  return range ? `${e.title} (${range})` : `${timeLabelOn(e, e.event_date)} ${e.title}`;
}

/**
 * Cloudflare Cron(5분마다)이 호출. Authorization: Bearer CRON_SECRET 필요.
 * ?dry=1 보내지 않고 대상만 반환, ?now=ISO 시각 가정(테스트용)
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !timingSafeEqual(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dry = searchParams.get("dry") === "1";
  const nowParam = searchParams.get("now");
  const now = kstNow(nowParam ? new Date(nowParam) : new Date());

  const supabase = createAdminClient();
  const { data: settings, error: settingsError } = await supabase
    .from("note_settings")
    .select("notify_time, notify_offsets")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  const notifyTime = (settings?.notify_time ?? "08:00").slice(0, 5);
  const offsets: number[] = settings?.notify_offsets ?? [0, 7];
  const elapsed = toMinutes(now.time) - toMinutes(notifyTime);
  if (elapsed < 0 || elapsed >= SEND_WINDOW_MIN || offsets.length === 0) {
    return NextResponse.json({ skipped: "outside send window", now, notifyTime });
  }

  const targets = offsets.map((d) => ({ daysBefore: d, date: addDays(now.date, d) }));
  const { data: events, error: eventsError } = await supabase
    .from("note_events")
    .select("id, title, event_date, event_time, end_date, end_time")
    .in(
      "event_date",
      targets.map((t) => t.date),
    )
    .order("event_time", { ascending: true, nullsFirst: true });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const ids = (events ?? []).map((e) => e.id);
  const { data: logs } = ids.length
    ? await supabase.from("note_push_log").select("event_id, days_before, event_date").in("event_id", ids)
    : { data: [] };
  const sentKeys = new Set((logs ?? []).map((l) => `${l.event_id}|${l.days_before}|${l.event_date}`));

  const results = [];
  for (const { daysBefore, date } of targets) {
    const pending = (events ?? []).filter(
      (e) => e.event_date === date && !sentKeys.has(`${e.id}|${daysBefore}|${date}`),
    ) as EventRow[];
    if (pending.length === 0) continue;

    const payload = {
      title: headline(daysBefore, date, pending.length),
      body: pending.map(line).join("\n"),
      url: "/calendar",
      tag: `events-${date}-${daysBefore}`,
    };

    if (dry) {
      results.push({ daysBefore, date, payload });
      continue;
    }

    const delivery = await sendToAll(payload);
    // 한 대라도 받았을 때만 기록. 기기가 없으면 나중에 켰을 때 창 안이면 다시 시도
    if (delivery.sent > 0) {
      await supabase
        .from("note_push_log")
        .upsert(
          pending.map((e) => ({ event_id: e.id, days_before: daysBefore, event_date: date })),
          { onConflict: "event_id,days_before,event_date", ignoreDuplicates: true },
        );
    }
    results.push({ daysBefore, date, count: pending.length, ...delivery });
  }

  return NextResponse.json({ now, notifyTime, dry, results });
}
