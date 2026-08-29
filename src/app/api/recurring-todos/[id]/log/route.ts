import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const done = !!body?.done;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("note_recurring_todo_logs")
    .upsert({ todo_id: id, log_date: date, done }, { onConflict: "todo_id,log_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
