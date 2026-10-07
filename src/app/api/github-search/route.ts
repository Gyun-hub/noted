import { NextResponse } from "next/server";

// ?q=이름 GitHub 저장소 이름 검색. 스타 많은 순 상위 몇 개 (진짜 저장소는 보통 맨 위)
// 비로그인 검색 API는 IP당 분당 10회 제한. GITHUB_TOKEN 이 있으면 씀 (없어도 동작)

const MAX_QUERY = 100;
const LIMIT = 3;
const TIMEOUT_MS = 8000;

type Repo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
};

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  if (q.length > MAX_QUERY) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${q} in:name`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(LIMIT));

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "noted-app",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 403 || res.status === 429) {
      return NextResponse.json({ error: "GitHub 검색이 잠깐 막혔어요. 1분 뒤 다시 해보세요" }, { status: 429 });
    }
    if (!res.ok) return NextResponse.json({ error: `GitHub 응답 실패 (${res.status})` }, { status: 502 });
    const data = (await res.json()) as { items?: Repo[] };
    return NextResponse.json({
      repos: (data.items ?? []).map((r) => ({
        name: r.full_name,
        url: r.html_url,
        description: r.description ?? "",
        stars: r.stargazers_count,
        pushedAt: r.pushed_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: "GitHub에 연결하지 못했어요" }, { status: 502 });
  }
}
