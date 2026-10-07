import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_QUERY = 50;
const LIMIT = 20;

/** ilike 패턴에서 %, _, \ 를 글자 그대로 찾게 */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** .or() 필터 안의 값은 쉼표·괄호가 구분자라 따옴표로 감쌈 */
function orValue(pattern: string) {
  return `"${pattern.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

// ?q= 할 일·반복 할 일·일정·장보기·아이디어·옷·도구 제목/내용에서 부분 일치
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  if (q.length > MAX_QUERY) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const pattern = likePattern(q);
  const supabase = createAdminClient();
  const [todos, recurring, events, products, ideas, clothes, tools] = await Promise.all([
    supabase
      .from("note_todos")
      .select("id, title, done, due_date")
      .ilike("title", pattern)
      .order("done", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("note_recurring_todos")
      .select("id, title, weekdays")
      .ilike("title", pattern)
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    supabase
      .from("note_events")
      .select("id, title, event_date, event_time, end_date, end_time, repeat, repeat_until")
      .ilike("title", pattern)
      .order("event_date", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("note_products")
      .select("id, name, done, store")
      .ilike("name", pattern)
      .order("done", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("note_ideas")
      .select("id, content, created_at")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("note_clothes")
      .select("id, category, brand, size_label, fit_notes")
      .or(`brand.ilike.${orValue(pattern)},fit_notes.ilike.${orValue(pattern)}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("note_tools")
      .select("id, name, kind, note, status")
      .or(`name.ilike.${orValue(pattern)},note.ilike.${orValue(pattern)},kind.ilike.${orValue(pattern)}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  const error = todos.error ?? recurring.error ?? events.error ?? products.error ?? ideas.error ?? clothes.error ?? tools.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    todos: todos.data ?? [],
    recurring: recurring.data ?? [],
    events: events.data ?? [],
    products: products.data ?? [],
    ideas: ideas.data ?? [],
    clothes: clothes.data ?? [],
    tools: tools.data ?? [],
  });
}
