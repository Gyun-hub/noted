import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  timingSafeEqual,
} from "@/lib/session";
import { GLOBAL_KEY, LIMITS, clearFailures, clientIp, lockedUntil, recordFailure } from "@/lib/login-guard";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const expected = process.env.APP_PIN ?? "";
  const ip = clientIp(request);

  // 실패 기록 확인이 안 되면 무제한 시도가 되므로 로그인 자체를 막음
  let until: number | null;
  try {
    until = await lockedUntil([ip, GLOBAL_KEY]);
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (until) {
    const retryAfter = Math.ceil((until - Date.now()) / 1000);
    return NextResponse.json(
      { error: "locked", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  if (!expected || !pin || !timingSafeEqual(pin, expected)) {
    await recordFailure([
      { key: ip, limit: LIMITS.ip },
      { key: GLOBAL_KEY, limit: LIMITS[GLOBAL_KEY] },
    ]).catch(() => {});
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  await clearFailures(ip).catch(() => {});

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
