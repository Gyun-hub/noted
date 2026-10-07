import { NextResponse } from "next/server";

// ?url= 상품 페이지를 대신 읽어서 대표 이미지 후보·상품명·가격·사이트명을 뽑아줌 (브라우저는 CORS 때문에 직접 못 읽음)

const MAX_IMAGES = 24;
const MAX_HTML = 2_000_000;
const TIMEOUT_MS = 8000;

/** 내부망·로컬 주소는 안 읽음 */
function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.includes(":")) return true; // IPv6 리터럴은 통째로 막음
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function meta(html: string, attr: "property" | "name", key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1].trim());
  }
  return "";
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url 필요" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json({ error: "주소 형식이 틀려요" }, { status: 400 });
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || isPrivateHost(url.hostname)) {
    return NextResponse.json({ error: "읽을 수 없는 주소예요" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NotedPreviewBot/1.0)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.json({ error: `상품 페이지 응답 실패 (${res.status})` }, { status: 502 });
    if (isPrivateHost(new URL(res.url).hostname)) {
      return NextResponse.json({ error: "읽을 수 없는 주소예요" }, { status: 400 });
    }
    html = (await res.text()).slice(0, MAX_HTML);
  } catch {
    return NextResponse.json({ error: "페이지를 가져오지 못했어요" }, { status: 502 });
  }

  const ogImage = meta(html, "property", "og:image");
  const imgTags = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
  const images: string[] = [];
  for (const src of ogImage ? [ogImage, ...imgTags] : imgTags) {
    if (src.startsWith("data:")) continue;
    let abs: string;
    try {
      abs = new URL(src, url).toString();
    } catch {
      continue;
    }
    if (!abs.startsWith("http") || images.includes(abs)) continue;
    images.push(abs);
    if (images.length >= MAX_IMAGES) break;
  }

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return NextResponse.json({
    images,
    title: meta(html, "property", "og:title") || (titleTag ? decodeEntities(titleTag[1].trim()) : ""),
    price: meta(html, "property", "product:price:amount") || meta(html, "property", "og:price:amount"),
    siteName: meta(html, "property", "og:site_name"),
  });
}
