import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_OFFSETS } from "@/lib/push";
import { TIME_RE } from "@/lib/validate";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_settings")
    .select("notify_time, notify_offsets")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    notifyTime: (data?.notify_time ?? "08:00").slice(0, 5),
    notifyOffsets: data?.notify_offsets ?? [0, 7],
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);

  const update: { notify_time?: string; notify_offsets?: number[]; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (body && "notifyTime" in body) {
    if (typeof body.notifyTime !== "string" || !TIME_RE.test(body.notifyTime)) {
      return NextResponse.json({ error: "notifyTime invalid" }, { status: 400 });
    }
    update.notify_time = body.notifyTime;
  }
  if (body && "notifyOffsets" in body) {
    const offsets = body.notifyOffsets;
    if (
      !Array.isArray(offsets) ||
      !offsets.every((d) => (ALLOWED_OFFSETS as readonly number[]).includes(d))
    ) {
      return NextResponse.json({ error: "notifyOffsets invalid" }, { status: 400 });
    }
    update.notify_offsets = [...new Set(offsets as number[])].sort((a, b) => a - b);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_settings").upsert({ id: 1, ...update }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
