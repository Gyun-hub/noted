"use client";

import { useEffect, useState } from "react";
import { getJson, send } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { EditActions, EditButton, InlineEdit } from "@/components/inline-edit";

type Idea = {
  id: string;
  content: string;
  created_at: string;
};

function toDateStr(d: Date) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertDate, setConvertDate] = useState("");

  async function load() {
    const data = await getJson<{ ideas: Idea[] }>("/api/ideas");
    if (data) setIdeas(data.ideas ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    if (!(await send("/api/ideas", "POST", { content: content.trim() }))) return;
    setContent("");
    load();
  }

  async function saveEdit(id: string, next: string) {
    setEditingId(null);
    setIdeas((list) => list.map((i) => (i.id === id ? { ...i, content: next } : i)));
    if (!(await send(`/api/ideas/${id}`, "PATCH", { content: next }))) load();
  }

  async function remove(id: string) {
    setIdeas((list) => list.filter((i) => i.id !== id));
    if (!(await send(`/api/ideas/${id}`, "DELETE"))) load();
  }

  function startConvert(id: string) {
    setEditingId(null);
    setConvertingId(id);
    setConvertDate(toDateStr(new Date()));
  }

  // 아이디어는 남겨두고 첫 줄을 제목으로 할 일 생성
  async function convertToTodo(e: React.FormEvent, idea: Idea) {
    e.preventDefault();
    const title = idea.content.split("\n")[0].trim().slice(0, 100);
    if (!title || !convertDate) return;
    if (!(await send("/api/todos", "POST", { title, dueDate: convertDate }))) return;
    setConvertingId(null);
    showToast(`할 일로 등록 · ${convertDate.slice(5).replace("-", ".")}`);
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
                  {editingId !== idea.id && (
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => startConvert(idea.id)}
                        aria-label="할 일로 등록"
                        className="grid h-6 w-6 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-accent-2-soft hover:text-accent-2"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M4 12.5l4.5 4.5L20 5.5M14 19h6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <EditButton onClick={() => setEditingId(idea.id)} />
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
                  )}
                </div>
                {editingId === idea.id ? (
                  <InlineEdit
                    value={idea.content}
                    multiline
                    onSave={(next) => saveEdit(idea.id, next)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{idea.content}</p>
                )}
                {convertingId === idea.id && (
                  <form
                    onSubmit={(e) => convertToTodo(e, idea)}
                    onKeyDown={(e) => e.key === "Escape" && setConvertingId(null)}
                    className="mt-3 flex items-center gap-2 border-t border-dashed pt-3"
                  >
                    <span className="flex-none font-mono text-[10px] uppercase tracking-wide text-accent-2">할 일로</span>
                    <input
                      type="date"
                      required
                      value={convertDate}
                      onChange={(e) => setConvertDate(e.target.value)}
                      className="ledger-input flex-1 py-1 font-mono text-xs"
                    />
                    <EditActions onCancel={() => setConvertingId(null)} />
                  </form>
                )}
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
