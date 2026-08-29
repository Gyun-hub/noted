"use client";

import { useEffect, useState } from "react";

type Idea = {
  id: string;
  content: string;
  created_at: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function IdeaPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [content, setContent] = useState("");

  async function load() {
    const res = await fetch("/api/ideas");
    const data = await res.json();
    setIdeas(data.ideas ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    setContent("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <header className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          아이디어 노트
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent" />
          idea
        </h1>
      </header>

      <form onSubmit={addIdea} className="mb-8 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="구현하고 싶은 것 적기"
          rows={3}
          className="ledger-input resize-none"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.98]"
        >
          기록
        </button>
      </form>

      <section className="rounded-xl border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
          기록됨
        </h2>

        {ideas.length > 0 ? (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-lg border border-dashed p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                    {formatDate(idea.created_at)}
                  </span>
                  <button
                    onClick={() => remove(idea.id)}
                    aria-label="삭제"
                    className="grid h-5 w-5 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{idea.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            아직 기록된 아이디어 없음
          </p>
        )}
      </section>
    </div>
  );
}
