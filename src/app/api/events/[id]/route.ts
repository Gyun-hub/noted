import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DATE_RE, TIME_RE } from "@/lib/validate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: { title?: string; event_date?: string; event_time?: string | null } = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "title empty" }, { status: 400 });
    update.title = title;
  }
  if (typeof body?.eventDate === "string") {
    if (!DATE_RE.test(body.eventDate)) {
      return NextResponse.json({ error: "eventDate invalid" }, { status: 400 });
    }
    update.event_date = body.eventDate;
  }
  // 빈 문자열/null = 종일
  if (body?.eventTime === null || body?.eventTime === "") update.event_time = null;
  else if (typeof body?.eventTime === "string") {
    if (!TIME_RE.test(body.eventTime)) {
      return NextResponse.json({ error: "eventTime invalid" }, { status: 400 });
    }
    update.event_time = body.eventTime;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "title, eventDate or eventTime required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_events").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
