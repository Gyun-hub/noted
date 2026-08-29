import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: recurring }, { data: oneOff }] = await Promise.all([
    supabase.from("note_recurring_todos").select("id, title").order("created_at", { ascending: true }),
    supabase.from("note_todos").select("id, title, done").order("created_at", { ascending: true }),
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const isRecurring = !!body?.isRecurring;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const supabase = createAdminClient();
  const table = isRecurring ? "note_recurring_todos" : "note_todos";
  const { error } = await supabase.from(table).insert({ title });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
