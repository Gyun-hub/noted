import { NextResponse } from "next/server";
import { sendToAll } from "@/lib/push";

// 설정 화면의 "테스트 알림 보내기"
export async function POST() {
  try {
    const result = await sendToAll({
      title: "noted",
      body: "알림이 잘 도착했어요.",
      url: "/settings",
      tag: "test",
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
