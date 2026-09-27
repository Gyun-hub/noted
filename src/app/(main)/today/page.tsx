"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton, InlineEdit } from "@/components/inline-edit";
import { WeekdayPicker, runsOn, weekdaysLabel } from "@/components/weekday-picker";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  due_date?: string | null;
};

type RecurringTodo = Todo & {
  weekdays: number[] | null;
};

type Event = {
  id: string;
  title: string;
  event_time: string | null;
};

const UNDO_MS = 4000;

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

function RecurringEditor({
  todo,
  onSave,
  onCancel,
}: {
  todo: RecurringTodo;
  onSave: (title: string, weekdays: number[]) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [weekdays, setWeekdays] = useState<number[]>(todo.weekdays ?? []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next) return onCancel();
    onSave(next, weekdays);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="flex flex-1 items-end gap-1"
    >
      <div className="flex-1 space-y-2">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="ledger-input" />
        <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      </div>
      <EditActions onCancel={onCancel} />
    </form>
  );
}

export default function TodayPage() {
  const [recurring, setRecurring] = useState<RecurringTodo[]>([]);
  const [oneOff, setOneOff] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Todo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const date = todayStr();
  const weekday = new Date().getDay();

  async function load() {
    const [todosData, eventsData] = await Promise.all([
      fetch(`/api/todos?date=${date}`).then((r) => r.json()),
      fetch(`/api/events?start=${date}&end=${date}`).then((r) => r.json()),
    ]);
    setRecurring(todosData.recurring ?? []);
    setOneOff(todosData.oneOff ?? []);
    setEvents(eventsData.events ?? []);
  }

  useEffect(() => {
    load();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isRecurring ? { title: title.trim(), isRecurring, weekdays } : { title: title.trim(), dueDate: date },
      ),
    });
    setTitle("");
    setIsRecurring(false);
    setWeekdays([]);
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

  function patchDone(todoId: string, done: boolean) {
    return fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  }

  // 완료한 할 일은 바로 안 사라지고 UNDO_MS 동안 체크된 채 남아서 되돌릴 수 있음
  async function toggleOneOff(todo: Todo) {
    const done = !todo.done;
    setOneOff((list) => list.map((t) => (t.id === todo.id ? { ...t, done } : t)));

    if (done) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo(todo);
      undoTimer.current = setTimeout(() => {
        setUndo(null);
        setOneOff((list) => list.filter((t) => !t.done));
      }, UNDO_MS);
    } else if (undo?.id === todo.id) {
      setUndo(null);
    }

    await patchDone(todo.id, done);
  }

  async function undoComplete() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const id = undo.id;
    setUndo(null);
    setOneOff((list) => list.map((t) => (t.id === id ? { ...t, done: false } : t)));
    await patchDone(id, false);
  }

  async function renameOneOff(todoId: string, next: string) {
    setEditingId(null);
    setOneOff((list) => list.map((t) => (t.id === todoId ? { ...t, title: next } : t)));
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
  }

  async function removeOneOff(todo: Todo) {
    if (!confirm(`"${todo.title}" 삭제할까요?`)) return;
    setOneOff((list) => list.filter((t) => t.id !== todo.id));
    await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
  }

  async function saveRecurring(todoId: string, next: string, nextWeekdays: number[]) {
    setEditingId(null);
    await fetch(`/api/recurring-todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next, weekdays: nextWeekdays }),
    });
    load();
  }

  async function removeRecurring(todo: RecurringTodo) {
    if (!confirm(`반복 할 일 "${todo.title}" 삭제할까요?\n지난 체크 기록도 같이 지워집니다.`)) return;
    setRecurring((list) => list.filter((t) => t.id !== todo.id));
    await fetch(`/api/recurring-todos/${todo.id}`, { method: "DELETE" });
  }

  const todayRecurring = recurring.filter((t) => runsOn(t.weekdays, weekday));
  const doneCount = todayRecurring.filter((t) => t.done).length;

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

      {events.length > 0 && (
        <section className="mb-6 rounded-xl border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              오늘 일정
            </h2>
            <Link href="/calendar" className="font-mono text-[11px] text-muted hover:text-accent">
              calendar →
            </Link>
          </div>
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-10 flex-none font-mono text-[11px] text-muted">
                  {e.event_time ? e.event_time.slice(0, 5) : "종일"}
                </span>
                <span className="flex-1">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <div className="flex flex-wrap items-center gap-3">
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
            반복
          </button>
          {isRecurring && <WeekdayPicker value={weekdays} onChange={setWeekdays} />}
        </div>
      </form>

      {todayRecurring.length > 0 && (
        <section className="mb-6 rounded-xl border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
              반복 스케줄
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {doneCount}/{todayRecurring.length}
            </span>
          </div>
          <ul className="space-y-3">
            {todayRecurring.map((t) => (
              <li key={t.id}>
                <LedgerCheck checked={t.done} onChange={() => toggleRecurring(t.id, t.done)}>
                  {t.title}
                </LedgerCheck>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 rounded-xl border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />할 일
        </h2>

        {oneOff.length > 0 ? (
          <ul className="space-y-3">
            {oneOff.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                {editingId === t.id ? (
                  <InlineEdit
                    value={t.title}
                    onSave={(next) => renameOneOff(t.id, next)}
                    onCancel={() => setEditingId(null)}
                    className="flex-1"
                  />
                ) : (
                  <>
                    <LedgerCheck checked={t.done} onChange={() => toggleOneOff(t)} className="flex-1">
                      {t.title}
                    </LedgerCheck>
                    {t.due_date && t.due_date < date && (
                      <span className="flex-none font-mono text-[10px] text-accent">
                        {t.due_date.slice(5).replace("-", ".")}
                      </span>
                    )}
                    <EditButton onClick={() => setEditingId(t.id)} />
                    <DeleteButton onClick={() => removeOneOff(t)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            남은 할 일 없음
          </p>
        )}
      </section>

      {recurring.length > 0 && (
        <details className="group rounded-xl border bg-surface p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
              반복 관리
            </span>
            <span className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 space-y-3">
            {recurring.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                {editingId === t.id ? (
                  <RecurringEditor
                    todo={t}
                    onSave={(next, nextWeekdays) => saveRecurring(t.id, next, nextWeekdays)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <span className="flex-1">{t.title}</span>
                    <span className="flex-none font-mono text-[10px] text-muted">{weekdaysLabel(t.weekdays)}</span>
                    <EditButton onClick={() => setEditingId(t.id)} />
                    <DeleteButton onClick={() => removeRecurring(t)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {undo && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-5">
          <div className="flex w-full max-w-md items-center gap-3 rounded-full border bg-surface px-4 py-2.5 text-sm shadow-lg">
            <span className="flex-1 truncate">
              <span className="text-muted">완료 · </span>
              {undo.title}
            </span>
            <button
              type="button"
              onClick={undoComplete}
              className="flex-none font-mono text-[11px] uppercase tracking-wide text-accent"
            >
              되돌리기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
