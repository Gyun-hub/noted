"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, Section } from "@/components/page";
import { weekdaysLabel } from "@/components/weekday-picker";
import { getJson } from "@/lib/api";
import { TOOL_STATUS_LABEL, type ToolStatus } from "@/lib/tools";
import { REPEAT_LABEL, monthDay, rangeLabel, shortTime, type EventRow } from "@/lib/events";

type Results = {
  todos: { id: string; title: string; done: boolean; due_date: string | null }[];
  recurring: { id: string; title: string; weekdays: number[] | null }[];
  events: EventRow[];
  products: { id: string; name: string; done: boolean; store: string | null }[];
  ideas: { id: string; content: string; created_at: string }[];
  clothes: { id: string; category: string; brand: string; size_label: string; fit_notes: string }[];
  tools: { id: string; name: string; kind: string; note: string; status: ToolStatus }[];
};

const DEBOUNCE_MS = 250;

/** 찾은 부분에 형광펜 */
function Highlight({ text, query }: { text: string; query: string }) {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1 && needle; at = lower.indexOf(needle, from)) {
    parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-mint-soft px-0.5 text-ink">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

/** 아이디어는 찾은 말이 있는 줄을 보여줌 */
function ideaLine(content: string, query: string) {
  const lines = content.split("\n");
  return lines.find((l) => l.toLowerCase().includes(query.toLowerCase())) ?? lines[0];
}

function Row({ href, title, query, meta, done }: { href: string; title: string; query: string; meta?: string; done?: boolean }) {
  return (
    <li>
      <Link href={href} className="row">
        <span className={`min-w-0 flex-1 truncate ${done ? "text-pencil line-through" : ""}`}>
          <Highlight text={title} query={query} />
        </span>
        {meta && <span className="flex-none text-[12px] text-pencil">{meta}</span>}
      </Link>
    </li>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; results: Results } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (!q) return;
    const timer = setTimeout(async () => {
      const results = await getJson<Results>(`/api/search?q=${encodeURIComponent(q)}`);
      if (results) setFound({ query: q, results });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // 입력이 바뀌면 이전 결과는 숨김 (새 결과 올 때까지)
  const results = found && found.query === q ? found.results : null;
  const total = results
    ? results.todos.length + results.recurring.length + results.events.length + results.products.length + results.ideas.length + results.clothes.length + results.tools.length
    : 0;

  return (
    <>
      <PageHeader title="검색" />

      <div className="composer mb-8">
        <label htmlFor="search" className="composer-label">
          할 일 · 일정 · 장보기 · 아이디어 · 옷 · 도구
        </label>
        <input
          id="search"
          type="search"
          autoFocus
          value={query}
          maxLength={50}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="찾을 말"
          className="composer-input"
        />
      </div>

      {q && !results && <p className="empty">찾는 중…</p>}
      {results && total === 0 && <p className="empty">&ldquo;{q}&rdquo;이 들어간 항목이 없어요</p>}

      {results && results.events.length > 0 && (
        <Section title="일정" tone="navy" aside={`${results.events.length}개`}>
          <ul>
            {results.events.map((e) => (
              <Row
                key={e.id}
                href={`/calendar?date=${e.event_date}`}
                title={e.title}
                query={q}
                meta={[
                  e.repeat ? `${REPEAT_LABEL[e.repeat]} 반복` : null,
                  rangeLabel(e) ?? [`${e.event_date.slice(0, 4)}. ${monthDay(e.event_date)}`, shortTime(e.event_time)].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </ul>
        </Section>
      )}

      {results && (results.todos.length > 0 || results.recurring.length > 0) && (
        <Section title="할 일" aside={`${results.todos.length + results.recurring.length}개`}>
          <ul>
            {results.recurring.map((t) => (
              <Row key={t.id} href="/today" title={t.title} query={q} meta={`${weekdaysLabel(t.weekdays)} 반복`} />
            ))}
            {results.todos.map((t) => (
              <Row
                key={t.id}
                href={t.due_date ? `/calendar?date=${t.due_date}` : "/today"}
                title={t.title}
                query={q}
                done={t.done}
                meta={t.due_date ? monthDay(t.due_date) : "날짜 없음"}
              />
            ))}
          </ul>
        </Section>
      )}

      {results && results.products.length > 0 && (
        <Section title="장보기" tone="blue" aside={`${results.products.length}개`}>
          <ul>
            {results.products.map((p) => (
              <Row
                key={p.id}
                href="/product"
                title={p.name}
                query={q}
                done={p.done}
                meta={p.done ? "산 것" : (p.store ?? undefined)}
              />
            ))}
          </ul>
        </Section>
      )}

      {results && results.ideas.length > 0 && (
        <Section title="아이디어" aside={`${results.ideas.length}개`}>
          <ul>
            {results.ideas.map((idea) => (
              <Row
                key={idea.id}
                href="/idea"
                title={ideaLine(idea.content, q)}
                query={q}
                meta={new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(idea.created_at))}
              />
            ))}
          </ul>
        </Section>
      )}

      {results && results.tools.length > 0 && (
        <Section title="써볼 도구" aside={`${results.tools.length}개`}>
          <ul>
            {results.tools.map((t) => (
              <Row
                key={t.id}
                href="/idea?view=tools"
                title={t.name.toLowerCase().includes(q.toLowerCase()) || !t.note ? t.name : `${t.name} · ${t.note.split("\n")[0]}`}
                query={q}
                done={t.status === "dropped"}
                meta={[t.kind, TOOL_STATUS_LABEL[t.status]].filter(Boolean).join(" · ")}
              />
            ))}
          </ul>
        </Section>
      )}

      {results && results.clothes.length > 0 && (
        <Section title="옷" aside={`${results.clothes.length}개`}>
          <ul>
            {results.clothes.map((c) => (
              <Row
                key={c.id}
                href="/closet"
                title={c.brand.toLowerCase().includes(q.toLowerCase()) ? c.brand : `${c.brand} · ${c.fit_notes}`}
                query={q}
                meta={[c.category, c.size_label].filter(Boolean).join(" ")}
              />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
