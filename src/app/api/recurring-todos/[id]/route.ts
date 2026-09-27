import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWeekdays } from "@/lib/validate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: { title?: string; weekdays?: number[] | null } = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "title empty" }, { status: 400 });
    update.title = title;
  }
  if (body && "weekdays" in body) {
    const weekdays = parseWeekdays(body.weekdays);
    if (weekdays === undefined) return NextResponse.json({ error: "weekdays invalid" }, { status: 400 });
    update.weekdays = weekdays;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "title or weekdays required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_recurring_todos").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// 체크 기록(note_recurring_todo_logs)은 on delete cascade로 같이 지워짐
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_recurring_todos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
