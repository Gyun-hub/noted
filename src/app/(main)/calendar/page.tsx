"use client";

import { useEffect, useMemo, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { runsOn } from "@/components/weekday-picker";
import { getJson, send } from "@/lib/api";

type Event = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
};

type Todo = {
  id: string;
  title: string;
  done: boolean;
  due_date: string;
};

type RecurringTodo = {
  id: string;
  title: string;
  weekdays: number[] | null;
  created_at: string;
};

type RecurringLog = {
  todo_id: string;
  log_date: string;
  done: boolean;
};

type Kind = "event" | "todo";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(d: Date) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function monthMatrix(year: number, month: number) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupByDate<T>(items: T[], key: (item: T) => string) {
  const map: Record<string, T[]> = {};
  for (const item of items) (map[key(item)] ??= []).push(item);
  return map;
}

/** "HH:MM:SS" -> "HH:MM" */
function shortTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : "";
}

// time을 넘기면(null 포함) 시간 입력칸도 표시. 빈 시간 = 종일
function DatedEditor({
  title: initialTitle,
  date: initialDate,
  time: initialTime,
  onSave,
  onCancel,
}: {
  title: string;
  date: string;
  time?: string | null;
  onSave: (title: string, date: string, time: string) => void;
  onCancel: () => void;
}) {
  const withTime = initialTime !== undefined;
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(shortTime(initialTime));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    const unchanged = next === initialTitle && date === initialDate && time === shortTime(initialTime);
    if (!next || !date || unchanged) return onCancel();
    onSave(next, date, time);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="flex flex-1 items-end gap-1"
    >
      <div className="flex-1 space-y-1">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="ledger-input" />
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ledger-input font-mono text-xs"
          />
          {withTime && (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="ledger-input font-mono text-xs"
            />
          )}
        </div>
      </div>
      <EditActions onCancel={onCancel} />
    </form>
  );
}

function SectionTitle({ dotClass, children, aside }: { dotClass: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {children}
      </h3>
      {aside && <span className="font-mono text-[10px] text-muted">{aside}</span>}
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(toDateStr(today));
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [recurring, setRecurring] = useState<RecurringTodo[]>([]);
  const [logs, setLogs] = useState<RecurringLog[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("event");
  const [time, setTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const todayStr = toDateStr(today);

  async function load() {
    const range = `start=${toDateStr(new Date(year, month, 1))}&end=${toDateStr(new Date(year, month + 1, 0))}`;
    const [eventsData, todosData] = await Promise.all([
      getJson<{ events: Event[] }>(`/api/events?${range}`),
      getJson<{ todos: Todo[]; recurring: RecurringTodo[]; logs: RecurringLog[] }>(`/api/todos?${range}`),
    ]);
    if (eventsData) setEvents(eventsData.events ?? []);
    if (todosData) {
      setTodos(todosData.todos ?? []);
      setRecurring(todosData.recurring ?? []);
      setLogs(todosData.logs ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const eventsByDate = useMemo(() => groupByDate(events, (e) => e.event_date), [events]);
  const todosByDate = useMemo(() => groupByDate(todos, (t) => t.due_date), [todos]);
  const logDone = useMemo(
    () => new Set(logs.filter((l) => l.done).map((l) => `${l.todo_id}|${l.log_date}`)),
    [logs],
  );

  const selectedEvents = eventsByDate[selected] ?? [];
  const selectedTodos = todosByDate[selected] ?? [];
  // 반복 할 일은 만든 날부터, 지정 요일에만 표시
  const selectedWeekday = new Date(`${selected}T00:00:00`).getDay();
  const selectedRecurring = recurring
    .filter((r) => toDateStr(new Date(r.created_at)) <= selected && runsOn(r.weekdays, selectedWeekday))
    .map((r) => ({ ...r, done: logDone.has(`${r.id}|${selected}`) }));
  const recurringDoneCount = selectedRecurring.filter((r) => r.done).length;
  const isEmpty = !selectedEvents.length && !selectedTodos.length && !selectedRecurring.length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ok =
      kind === "event"
        ? await send("/api/events", "POST", { title: title.trim(), eventDate: selected, eventTime: time || null })
        : await send("/api/todos", "POST", { title: title.trim(), dueDate: selected });
    if (!ok) return;
    setTitle("");
    setTime("");
    load();
  }

  async function saveEvent(id: string, nextTitle: string, eventDate: string, eventTime: string) {
    setEditingId(null);
    setEvents((list) =>
      list.map((e) =>
        e.id === id ? { ...e, title: nextTitle, event_date: eventDate, event_time: eventTime || null } : e,
      ),
    );
    await send(`/api/events/${id}`, "PATCH", { title: nextTitle, eventDate, eventTime: eventTime || null });
    load();
  }

  async function removeEvent(id: string) {
    setEvents((list) => list.filter((e) => e.id !== id));
    if (!(await send(`/api/events/${id}`, "DELETE"))) load();
  }

  async function saveTodo(id: string, nextTitle: string, dueDate: string) {
    setEditingId(null);
    setTodos((list) => list.map((t) => (t.id === id ? { ...t, title: nextTitle, due_date: dueDate } : t)));
    await send(`/api/todos/${id}`, "PATCH", { title: nextTitle, dueDate });
    load();
  }

  async function removeTodo(todo: Todo) {
    if (!confirm(`"${todo.title}" 삭제할까요?`)) return;
    setTodos((list) => list.filter((t) => t.id !== todo.id));
    if (!(await send(`/api/todos/${todo.id}`, "DELETE"))) load();
  }

  async function toggleTodo(id: string, current: boolean) {
    setTodos((list) => list.map((t) => (t.id === id ? { ...t, done: !current } : t)));
    if (!(await send(`/api/todos/${id}`, "PATCH", { done: !current }))) load();
  }

  async function toggleRecurring(todoId: string, current: boolean) {
    const date = selected;
    setLogs((list) => [
      ...list.filter((l) => !(l.todo_id === todoId && l.log_date === date)),
      { todo_id: todoId, log_date: date, done: !current },
    ]);
    if (!(await send(`/api/recurring-todos/${todoId}/log`, "PUT", { date, done: !current }))) load();
  }

  function shiftMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  const selectedLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${selected}T00:00:00`));

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <header className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">schedule</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent-2" />
          calendar
        </h1>
      </header>

      <div className="mb-6 rounded-xl border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => shiftMonth(-1)}
            className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            {year}.{String(month + 1).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => shiftMonth(1)}
            className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-center font-mono text-[10px] uppercase text-muted">
              {w}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const dStr = toDateStr(date);
            const isSelected = dStr === selected;
            const isToday = dStr === todayStr;
            const hasEvents = !!eventsByDate[dStr]?.length;
            const hasTodos = !!todosByDate[dStr]?.some((t) => !t.done);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelected(dStr);
                  setEditingId(null);
                }}
                className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors"
                style={{
                  background: isSelected ? "var(--accent)" : "transparent",
                  color: isSelected ? "#fff" : "var(--text)",
                  boxShadow: !isSelected && isToday ? "inset 0 0 0 1.5px var(--accent-2)" : "none",
                }}
              >
                {date.getDate()}
                <span className="flex h-1 gap-0.5">
                  {hasEvents && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? "#fff" : "var(--accent)" }}
                    />
                  )}
                  {hasTodos && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? "#fff" : "var(--accent-2)" }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end gap-3 font-mono text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            일정
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />할 일
          </span>
        </div>
      </div>

      <section className="rounded-xl border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {selectedLabel}
        </h2>

        <form onSubmit={add} className="mb-5 space-y-3">
          <div className="flex items-end gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "event" ? "일정 등록" : "할 일 등록"}
              className="ledger-input"
            />
            <button
              type="submit"
              aria-label="등록"
              className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent text-white transition-transform active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["event", "일정", "accent"],
                ["todo", "할 일", "accent-2"],
              ] as const
            ).map(([value, label, color]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors"
                style={
                  kind === value
                    ? { background: `var(--${color}-soft)`, borderColor: `var(--${color})`, color: `var(--${color})` }
                    : { color: "var(--text-muted)" }
                }
              >
                {label}
              </button>
            ))}
            {kind === "event" && (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="시간 (비우면 종일)"
                className="ledger-input ml-auto w-28 py-1 font-mono text-xs"
              />
            )}
          </div>
        </form>

        {isEmpty && (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            등록된 일정·할 일 없음
          </p>
        )}

        {selectedEvents.length > 0 && (
          <div className="mb-5">
            <SectionTitle dotClass="bg-accent">일정</SectionTitle>
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  {editingId === e.id ? (
                    <DatedEditor
                      title={e.title}
                      date={e.event_date}
                      time={e.event_time}
                      onSave={(nextTitle, date, nextTime) => saveEvent(e.id, nextTitle, date, nextTime)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <span className="w-10 flex-none font-mono text-[11px] text-muted">
                        {shortTime(e.event_time) || "종일"}
                      </span>
                      <span className="flex-1">{e.title}</span>
                      <EditButton onClick={() => setEditingId(e.id)} />
                      <DeleteButton onClick={() => removeEvent(e.id)} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedTodos.length > 0 && (
          <div className="mb-5">
            <SectionTitle dotClass="bg-accent-2">할 일</SectionTitle>
            <ul className="space-y-3">
              {selectedTodos.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  {editingId === t.id ? (
                    <DatedEditor
                      title={t.title}
                      date={t.due_date}
                      onSave={(nextTitle, date) => saveTodo(t.id, nextTitle, date)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <LedgerCheck checked={t.done} onChange={() => toggleTodo(t.id, t.done)} className="flex-1">
                        {t.title}
                      </LedgerCheck>
                      <EditButton onClick={() => setEditingId(t.id)} />
                      <DeleteButton onClick={() => removeTodo(t)} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedRecurring.length > 0 && (
          <div>
            <SectionTitle dotClass="bg-accent-2" aside={`${recurringDoneCount}/${selectedRecurring.length}`}>
              반복 스케줄
            </SectionTitle>
            <ul className="space-y-3">
              {selectedRecurring.map((r) => (
                <li key={r.id}>
                  <LedgerCheck checked={r.done} onChange={() => toggleRecurring(r.id, r.done)}>
                    {r.title}
                  </LedgerCheck>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
