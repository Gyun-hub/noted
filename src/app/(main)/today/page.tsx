"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton, InlineEdit } from "@/components/inline-edit";
import { WeekdayPicker, runsOn, weekdaysLabel } from "@/components/weekday-picker";
import { RecurringHistory, STREAK_WINDOW, addDays } from "@/components/recurring-history";
import { getJson, send } from "@/lib/api";
import { dismissToast, showToast } from "@/lib/toast";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  due_date?: string | null;
};

type RecurringTodo = Todo & {
  weekdays: number[] | null;
  created_at: string;
};

type Event = {
  id: string;
  title: string;
  event_time: string | null;
};

type TodosResponse = { recurring: RecurringTodo[]; oneOff: Todo[] };
type EventsResponse = { events: Event[] };
type HistoryResponse = { logs: { todo_id: string; log_date: string; done: boolean }[] };

const UNDO_MS = 4000;

function toDateStr(d: Date) {
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
  // 반복 관리 펼쳤을 때만 불러옴. `${todo_id}|${date}` 완료 기록
  const [history, setHistory] = useState<Set<string> | null>(null);
  const [title, setTitle] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoToast = useRef<number | null>(null);
  const date = toDateStr(new Date());
  const weekday = new Date().getDay();

  async function load() {
    const [todosData, eventsData] = await Promise.all([
      getJson<TodosResponse>(`/api/todos?date=${date}`),
      getJson<EventsResponse>(`/api/events?start=${date}&end=${date}`),
    ]);
    if (todosData) {
      setRecurring(todosData.recurring ?? []);
      setOneOff(todosData.oneOff ?? []);
    }
    if (eventsData) setEvents(eventsData.events ?? []);
  }

  async function loadHistory() {
    const data = await getJson<HistoryResponse>(`/api/todos?start=${addDays(date, -STREAK_WINDOW + 1)}&end=${date}`);
    if (data) setHistory(new Set(data.logs.filter((l) => l.done).map((l) => `${l.todo_id}|${l.log_date}`)));
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
    const ok = await send(
      "/api/todos",
      "POST",
      isRecurring ? { title: title.trim(), isRecurring, weekdays } : { title: title.trim(), dueDate: date },
    );
    if (!ok) return;
    setTitle("");
    setIsRecurring(false);
    setWeekdays([]);
    load();
  }

  async function toggleRecurring(todoId: string, current: boolean) {
    const done = !current;
    setRecurring((r) => r.map((t) => (t.id === todoId ? { ...t, done } : t)));
    setHistory((h) => {
      if (!h) return h;
      const next = new Set(h);
      if (done) next.add(`${todoId}|${date}`);
      else next.delete(`${todoId}|${date}`);
      return next;
    });
    if (!(await send(`/api/recurring-todos/${todoId}/log`, "PUT", { date, done }))) {
      load();
      if (history) loadHistory();
    }
  }

  // 완료한 할 일은 UNDO_MS 동안 체크된 채 남고, 그 사이 토스트나 체크 해제로 되돌릴 수 있음
  async function toggleOneOff(todo: Todo) {
    const done = !todo.done;
    setOneOff((list) => list.map((t) => (t.id === todo.id ? { ...t, done } : t)));

    if (done) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (undoToast.current) dismissToast(undoToast.current);
      undoToast.current = showToast(`완료 · ${todo.title}`, {
        duration: UNDO_MS,
        action: { label: "되돌리기", onClick: () => toggleOneOff({ ...todo, done: true }) },
      });
      undoTimer.current = setTimeout(() => {
        setOneOff((list) => list.filter((t) => !t.done));
      }, UNDO_MS);
    } else if (undoToast.current) {
      dismissToast(undoToast.current);
    }

    if (!(await send(`/api/todos/${todo.id}`, "PATCH", { done }))) load();
  }

  async function renameOneOff(todoId: string, next: string) {
    setEditingId(null);
    setOneOff((list) => list.map((t) => (t.id === todoId ? { ...t, title: next } : t)));
    if (!(await send(`/api/todos/${todoId}`, "PATCH", { title: next }))) load();
  }

  async function removeOneOff(todo: Todo) {
    if (!confirm(`"${todo.title}" 삭제할까요?`)) return;
    setOneOff((list) => list.filter((t) => t.id !== todo.id));
    if (!(await send(`/api/todos/${todo.id}`, "DELETE"))) load();
  }

  async function saveRecurring(todoId: string, next: string, nextWeekdays: number[]) {
    setEditingId(null);
    await send(`/api/recurring-todos/${todoId}`, "PATCH", { title: next, weekdays: nextWeekdays });
    load();
  }

  async function removeRecurring(todo: RecurringTodo) {
    if (!confirm(`반복 할 일 "${todo.title}" 삭제할까요?\n지난 체크 기록도 같이 지워집니다.`)) return;
    setRecurring((list) => list.filter((t) => t.id !== todo.id));
    if (!(await send(`/api/recurring-todos/${todo.id}`, "DELETE"))) load();
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
        <details
          className="group rounded-xl border bg-surface p-4"
          onToggle={(e) => {
            if (e.currentTarget.open && !history) loadHistory();
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
              반복 관리
            </span>
            <span className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 space-y-4">
            {recurring.map((t) => (
              <li key={t.id} className="text-sm">
                {editingId === t.id ? (
                  <div className="flex">
                    <RecurringEditor
                      todo={t}
                      onSave={(next, nextWeekdays) => saveRecurring(t.id, next, nextWeekdays)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="flex-1">{t.title}</span>
                      <span className="flex-none font-mono text-[10px] text-muted">{weekdaysLabel(t.weekdays)}</span>
                      <EditButton onClick={() => setEditingId(t.id)} />
                      <DeleteButton onClick={() => removeRecurring(t)} />
                    </div>
                    {history && (
                      <RecurringHistory
                        weekdays={t.weekdays}
                        createdDate={toDateStr(new Date(t.created_at))}
                        today={date}
                        isDone={(d) => history.has(`${t.id}|${d}`)}
                      />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
