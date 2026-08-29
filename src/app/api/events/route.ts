import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_events")
    .select("id, title, event_date")
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate : "";
  if (!title || !eventDate) {
    return NextResponse.json({ error: "title and eventDate required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_events").insert({ title, event_date: eventDate });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
