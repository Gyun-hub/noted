import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_COLUMNS, expandEvents, parseSchedule, type EventRow } from "@/lib/events";
import { DATE_RE } from "@/lib/validate";

// 기간 [start, end]와 겹치는 일정: 시작일 <= end 이고 종료일(없으면 시작일) >= start
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  // 반복 일정은 시작일이 기간 전이어도 회차가 기간 안에 올 수 있어 일단 가져와 펼침
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_events")
    .select(EVENT_COLUMNS)
    .lte("event_date", end)
    .or(`repeat.not.is.null,end_date.gte.${start},and(end_date.is.null,event_date.gte.${start})`)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: expandEvents((data ?? []) as EventRow[], start, end) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const schedule = parseSchedule(body);
  if (!schedule.ok) return NextResponse.json({ error: schedule.error }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_events").insert({ title, ...schedule.value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
