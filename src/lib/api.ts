import { showToast } from "@/lib/toast";

// 세션 만료 시 proxy가 /login으로 리다이렉트 → fetch는 로그인 페이지 HTML을 받음
function redirectedToLogin(res: Response) {
  if (res.redirected && new URL(res.url).pathname.startsWith("/login")) {
    // 클라이언트 상태를 전부 버리려고 일부러 전체 새로고침
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    return true;
  }
  return false;
}

/** 실패하면 토스트 띄우고 null */
export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (redirectedToLogin(res)) return null;
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    showToast("데이터를 불러오지 못했어요. 서버 연결을 확인하세요.", { tone: "error" });
    return null;
  }
}

/** 실패하면 토스트 띄우고 false. 호출 쪽은 false면 다시 load()해서 낙관적 반영을 되돌림 */
export async function send(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (redirectedToLogin(res)) return false;
    if (!res.ok) throw new Error(String(res.status));
    return true;
  } catch {
    showToast("저장하지 못했어요. 다시 시도하세요.", { tone: "error" });
    return false;
  }
}
