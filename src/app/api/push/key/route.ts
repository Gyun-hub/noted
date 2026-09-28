import { NextResponse } from "next/server";

// 브라우저 구독에 필요한 VAPID 공개키. 빌드 시점이 아니라 런타임 env에서 읽음
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "push not configured" }, { status: 503 });
  return NextResponse.json({ publicKey });
}
