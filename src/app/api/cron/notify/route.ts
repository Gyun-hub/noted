import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_COLUMNS, expandEvents, monthDay, rangeLabel, timeLabelOn, type EventRow } from "@/lib/events";
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
    .select("notify_time, notify_offsets, notify_todos")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  const notifyTime = (settings?.notify_time ?? "08:00").slice(0, 5);
  const offsets: number[] = settings?.notify_offsets ?? [0, 7];
  const notifyTodos: boolean = settings?.notify_todos ?? true;
  const elapsed = toMinutes(now.time) - toMinutes(notifyTime);
  if (elapsed < 0 || elapsed >= SEND_WINDOW_MIN || (offsets.length === 0 && !notifyTodos)) {
    return NextResponse.json({ skipped: "outside send window", now, notifyTime });
  }

  const targets = offsets.map((d) => ({ daysBefore: d, date: addDays(now.date, d) }));
  const dates = targets.map((t) => t.date);
  // 반복 일정은 첫 회 날짜가 달라 따로 가져와 회차로 펼친 뒤, 회차 시작일이 대상 날짜인 것만
  const { data: rows, error: eventsError } = dates.length
    ? await supabase
        .from("note_events")
        .select(EVENT_COLUMNS)
        .or(`event_date.in.(${dates.join(",")}),repeat.not.is.null`)
        .lte("event_date", dates.reduce((a, b) => (a > b ? a : b)))
        .order("event_time", { ascending: true, nullsFirst: true })
    : { data: [], error: null };
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  const events = dates.flatMap((date) =>
    expandEvents((rows ?? []) as EventRow[], date, date).filter((e) => e.event_date === date),
  );

  const ids = [...new Set(events.map((e) => e.id))];
  const { data: logs } = ids.length
    ? await supabase.from("note_push_log").select("event_id, days_before, event_date").in("event_id", ids)
    : { data: [] };
  const sentKeys = new Set((logs ?? []).map((l) => `${l.event_id}|${l.days_before}|${l.event_date}`));

  const results = [];
  for (const { daysBefore, date } of targets) {
    const pending = events.filter((e) => e.event_date === date && !sentKeys.has(`${e.id}|${daysBefore}|${date}`));
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

  if (notifyTodos) {
    const todoResult = await notifyDueTodos(supabase, now.date, dry);
    if ("error" in todoResult) return NextResponse.json({ error: todoResult.error }, { status: 500 });
    if (todoResult.result) results.push(todoResult.result);
  }

  return NextResponse.json({ now, notifyTime, dry, results });
}

/** 오늘 마감인 안 끝난 할 일. 할 일마다 마감일 기준 한 번만 */
async function notifyDueTodos(supabase: ReturnType<typeof createAdminClient>, date: string, dry: boolean) {
  const { data: todos, error } = await supabase
    .from("note_todos")
    .select("id, title")
    .eq("due_date", date)
    .eq("done", false)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  if (!todos?.length) return { result: null };

  const { data: logs, error: logError } = await supabase
    .from("note_push_todo_log")
    .select("todo_id")
    .eq("due_date", date)
    .in(
      "todo_id",
      todos.map((t) => t.id),
    );
  if (logError) return { error: logError.message };
  const sent = new Set((logs ?? []).map((l) => l.todo_id));
  const pending = todos.filter((t) => !sent.has(t.id));
  if (pending.length === 0) return { result: null };

  const payload = {
    title: `오늘 할 일 ${pending.length}개`,
    body: pending.map((t) => `· ${t.title}`).join("\n"),
    url: "/today",
    tag: `todos-${date}`,
  };
  if (dry) return { result: { todos: true, date, payload } };

  const delivery = await sendToAll(payload);
  if (delivery.sent > 0) {
    await supabase
      .from("note_push_todo_log")
      .upsert(
        pending.map((t) => ({ todo_id: t.id, due_date: date })),
        { onConflict: "todo_id,due_date", ignoreDuplicates: true },
      );
  }
  return { result: { todos: true, date, count: pending.length, ...delivery } };
}
