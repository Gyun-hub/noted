import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSchedule, type Repeat } from "@/lib/events";

// 제목만, 또는 일정(eventDate 필수 + eventTime/endDate/endTime/repeat/repeatUntil) 전체를 한 번에 수정.
// 반복 일정은 회차가 아니라 전체가 바뀜
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: {
    title?: string;
    event_date?: string;
    event_time?: string | null;
    end_date?: string | null;
    end_time?: string | null;
    repeat?: Repeat | null;
    repeat_until?: string | null;
  } = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "title empty" }, { status: 400 });
    update.title = title;
  }
  if (body && "eventDate" in body) {
    const schedule = parseSchedule(body);
    if (!schedule.ok) return NextResponse.json({ error: schedule.error }, { status: 400 });
    Object.assign(update, schedule.value);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "title or eventDate required" }, { status: 400 });
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
