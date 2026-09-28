import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = await verifySessionToken(token);
  const isLoginPath = request.nextUrl.pathname.startsWith("/login");

  if (!authed && !isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (authed && isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|api/auth/login|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
