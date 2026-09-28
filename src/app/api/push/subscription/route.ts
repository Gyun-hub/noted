import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 이 기기 알림 켜기: PushSubscription.toJSON() 그대로 받음
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "subscription invalid" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("note_push_subscriptions")
    .upsert({ endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// 이 기기 알림 끄기
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
