"use client";

import { useEffect, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";

type Todo = {
  id: string;
  title: string;
  done: boolean;
};

function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function todayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
    .format(new Date())
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function TodayPage() {
  const [recurring, setRecurring] = useState<Todo[]>([]);
  const [oneOff, setOneOff] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const date = todayStr();

  async function load() {
    const res = await fetch(`/api/todos?date=${date}`);
    const data = await res.json();
    setRecurring(data.recurring ?? []);
    setOneOff((data.oneOff ?? []).filter((t: Todo) => !t.done));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), isRecurring }),
    });
    setTitle("");
    setIsRecurring(false);
    load();
  }

  async function toggleRecurring(todoId: string, current: boolean) {
    setRecurring((r) => r.map((t) => (t.id === todoId ? { ...t, done: !current } : t)));
    await fetch(`/api/recurring-todos/${todoId}/log`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, done: !current }),
    });
  }

  async function toggleOneOff(todoId: string, current: boolean) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !current }),
    });
    load();
  }

  const doneCount = recurring.filter((t) => t.done).length;

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <header className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {todayLabel()}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent" />
          today
        </h1>
      </header>

      <form onSubmit={addTodo} className="mb-8 space-y-3">
        <div className="flex items-end gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일 추가"
            className="ledger-input"
          />
          <button
            type="submit"
            aria-label="추가"
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent text-white transition-transform active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsRecurring((v) => !v)}
          aria-pressed={isRecurring}
          className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors"
          style={
            isRecurring
              ? { background: "var(--accent-2-soft)", borderColor: "var(--accent-2)", color: "var(--accent-2)" }
              : { color: "var(--text-muted)" }
          }
        >
          매일 반복
        </button>
      </form>

      {recurring.length > 0 && (
        <section className="mb-6 rounded-xl border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
              반복 스케줄
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {doneCount}/{recurring.length}
            </span>
          </div>
          <ul className="space-y-3">
            {recurring.map((t) => (
              <li key={t.id}>
                <LedgerCheck checked={t.done} onChange={() => toggleRecurring(t.id, t.done)}>
                  {t.title}
                </LedgerCheck>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />할 일
        </h2>
        {oneOff.length > 0 ? (
          <ul className="space-y-3">
            {oneOff.map((t) => (
              <li key={t.id}>
                <LedgerCheck checked={t.done} onChange={() => toggleOneOff(t.id, t.done)}>
                  {t.title}
                </LedgerCheck>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            남은 할 일 없음
          </p>
        )}
      </section>
    </div>
  );
}
