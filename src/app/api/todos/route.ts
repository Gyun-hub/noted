import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DATE_RE, parseWeekdays } from "@/lib/validate";

// ?date=D        today 화면: 반복 할 일 전체(요일 포함) + D의 체크 상태 + 안 끝난 일회성 할 일(날짜 없음 또는 D 이전)
// ?start=S&end=E 캘린더: 기간 안 날짜가 붙은 일회성 할 일(완료 포함) + 반복 할 일 + 기간 내 체크 로그
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (start && end) {
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return NextResponse.json({ error: "start/end invalid" }, { status: 400 });
    }
    return getRange(start, end);
  }

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: recurring }, { data: oneOff }] = await Promise.all([
    supabase.from("note_recurring_todos").select("id, title, weekdays").order("created_at", { ascending: true }),
    supabase
      .from("note_todos")
      .select("id, title, done, due_date")
      .eq("done", false)
      .or(`due_date.is.null,due_date.lte.${date}`)
      .order("created_at", { ascending: true }),
  ]);

  let doneMap: Record<string, boolean> = {};
  if (recurring && recurring.length > 0) {
    const { data: logs } = await supabase
      .from("note_recurring_todo_logs")
      .select("todo_id, done")
      .eq("log_date", date)
      .in(
        "todo_id",
        recurring.map((t) => t.id),
      );
    doneMap = Object.fromEntries((logs ?? []).map((l) => [l.todo_id, l.done]));
  }

  return NextResponse.json({
    recurring: (recurring ?? []).map((t) => ({ ...t, done: !!doneMap[t.id] })),
    oneOff: oneOff ?? [],
  });
}

async function getRange(start: string, end: string) {
  const supabase = createAdminClient();

  const [todosRes, recurringRes, logsRes] = await Promise.all([
    supabase
      .from("note_todos")
      .select("id, title, done, due_date")
      .gte("due_date", start)
      .lte("due_date", end)
      .order("created_at", { ascending: true }),
    supabase
      .from("note_recurring_todos")
      .select("id, title, weekdays, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("note_recurring_todo_logs")
      .select("todo_id, log_date, done")
      .gte("log_date", start)
      .lte("log_date", end),
  ]);
  const error = todosRes.error ?? recurringRes.error ?? logsRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    todos: todosRes.data ?? [],
    recurring: recurringRes.data ?? [],
    logs: logsRes.data ?? [],
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const isRecurring = !!body?.isRecurring;
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : null;
  const weekdays = parseWeekdays(body?.weekdays ?? null);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (dueDate !== null && !DATE_RE.test(dueDate)) {
    return NextResponse.json({ error: "dueDate invalid" }, { status: 400 });
  }
  if (weekdays === undefined) return NextResponse.json({ error: "weekdays invalid" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = isRecurring
    ? await supabase.from("note_recurring_todos").insert({ title, weekdays })
    : await supabase.from("note_todos").insert({ title, due_date: dueDate });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
