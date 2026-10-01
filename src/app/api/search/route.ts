import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_QUERY = 50;
const LIMIT = 20;

/** ilike 패턴에서 %, _, \ 를 글자 그대로 찾게 */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ?q= 할 일·반복 할 일·일정·장보기·아이디어 제목/내용에서 부분 일치
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  if (q.length > MAX_QUERY) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const pattern = likePattern(q);
  const supabase = createAdminClient();
  const [todos, recurring, events, products, ideas] = await Promise.all([
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
  ]);

  const error = todos.error ?? recurring.error ?? events.error ?? products.error ?? ideas.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    todos: todos.data ?? [],
    recurring: recurring.data ?? [],
    events: events.data ?? [],
    products: products.data ?? [],
    ideas: ideas.data ?? [],
  });
}
