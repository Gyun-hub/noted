"use client";

import { useEffect, useMemo, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { AddIcon, PageHeader } from "@/components/page";
import { ScheduleFields, emptySchedule, scheduleToBody, type Schedule } from "@/components/schedule-fields";
import { runsOn } from "@/components/weekday-picker";
import { getJson, send } from "@/lib/api";
import { REPEAT_LABEL, endDateOf, eventKey, isMultiDay, rangeLabel, shortTime, timeLabelOn, type EventRow } from "@/lib/events";
import { showToast } from "@/lib/toast";

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

/** "YYYY-MM-DD" 기준 n일 이동 */
function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

// 반복 일정 회차를 눌러도 수정은 첫 회 날짜 기준 (전체가 바뀜)
function eventToSchedule(e: EventRow): Schedule {
  const origin = e.series ?? e;
  return {
    startDate: origin.event_date,
    startTime: shortTime(e.event_time),
    endDate: endDateOf(origin),
    endTime: shortTime(e.end_time),
    repeat: e.repeat ?? "",
    repeatUntil: e.repeat_until ?? "",
  };
}

function EventEditor({
  event,
  onSave,
  onCancel,
}: {
  event: EventRow;
  onSave: (title: string, schedule: Schedule) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [schedule, setSchedule] = useState(() => eventToSchedule(event));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next || scheduleToBody(schedule).error) return;
    onSave(next, schedule);
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="w-full space-y-3 py-2">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="일정 이름" className="field" />
      <ScheduleFields value={schedule} onChange={setSchedule} />
      {event.repeat && <p className="text-[12px] text-pencil">반복 일정은 모든 회차가 함께 바뀌어요</p>}
      <div className="flex justify-end">
        <EditActions onCancel={onCancel} />
      </div>
    </form>
  );
}

function TodoEditor({
  todo,
  onSave,
  onCancel,
}: {
  todo: Todo;
  onSave: (title: string, date: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [date, setDate] = useState(todo.due_date);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next || !date || (next === todo.title && date === todo.due_date)) return onCancel();
    onSave(next, date);
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="w-full space-y-2 py-2">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="할 일" className="field" />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="날짜"
          className="field field-sm w-auto"
        />
        <div className="ml-auto">
          <EditActions onCancel={onCancel} />
        </div>
      </div>
    </form>
  );
}

function GroupTitle({ color, children, aside }: { color: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <h3 className="mt-6 flex items-baseline justify-between text-[13px] font-semibold" style={{ color }}>
      {children}
      {aside && <span className="font-normal text-pencil">{aside}</span>}
    </h3>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const todayStr = toDateStr(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(todayStr);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [recurring, setRecurring] = useState<RecurringTodo[]>([]);
  const [logs, setLogs] = useState<RecurringLog[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("event");
  const [schedule, setSchedule] = useState<Schedule>(() => emptySchedule(todayStr));
  const [editingId, setEditingId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const monthStart = toDateStr(new Date(year, month, 1));
  const monthEnd = toDateStr(new Date(year, month + 1, 0));

  async function load() {
    const range = `start=${monthStart}&end=${monthEnd}`;
    const [eventsData, todosData] = await Promise.all([
      getJson<{ events: EventRow[] }>(`/api/events?${range}`),
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

  // 홈 화면에서 /calendar?date=YYYY-MM-DD 로 들어오면 그 날을 선택
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const [y, m] = date.split("-").map(Number);
    setCursor(new Date(y, m - 1, 1));
    setSelected(date);
    setSchedule(emptySchedule(date));
  }, []);

  // 기간 일정은 이번 달 안의 모든 날짜에 펼침
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const e of events) {
      const last = endDateOf(e) < monthEnd ? endDateOf(e) : monthEnd;
      for (let d = e.event_date > monthStart ? e.event_date : monthStart; d <= last; d = addDays(d, 1)) {
        (map[d] ??= []).push(e);
      }
    }
    return map;
  }, [events, monthStart, monthEnd]);
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

  function selectDay(date: string) {
    setSelected(date);
    setSchedule(emptySchedule(date));
    setEditingId(null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    let ok: boolean;
    if (kind === "event") {
      const parsed = scheduleToBody(schedule);
      if (parsed.error) return showToast(parsed.error, { tone: "error" });
      ok = await send("/api/events", "POST", { title: title.trim(), ...parsed.body });
    } else {
      ok = await send("/api/todos", "POST", { title: title.trim(), dueDate: selected });
    }
    if (!ok) return;
    setTitle("");
    setSchedule(emptySchedule(selected));
    load();
  }

  async function saveEvent(id: string, nextTitle: string, next: Schedule) {
    const parsed = scheduleToBody(next);
    if (parsed.error) return showToast(parsed.error, { tone: "error" });
    setEditingId(null);
    await send(`/api/events/${id}`, "PATCH", { title: nextTitle, ...parsed.body });
    load();
  }

  async function removeEvent(event: EventRow) {
    const message = event.repeat
      ? `반복 일정 "${event.title}"을 지울까요? 모든 회차가 지워져요.`
      : `일정 "${event.title}"을 지울까요?`;
    if (!confirm(message)) return;
    setEvents((list) => list.filter((e) => e.id !== event.id));
    if (!(await send(`/api/events/${event.id}`, "DELETE"))) load();
  }

  async function saveTodo(id: string, nextTitle: string, dueDate: string) {
    setEditingId(null);
    setTodos((list) => list.map((t) => (t.id === id ? { ...t, title: nextTitle, due_date: dueDate } : t)));
    await send(`/api/todos/${id}`, "PATCH", { title: nextTitle, dueDate });
    load();
  }

  async function removeTodo(todo: Todo) {
    if (!confirm(`할 일 "${todo.title}"을 지울까요?`)) return;
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

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    selectDay(todayStr);
  }

  const selectedLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${selected}T00:00:00`));

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <>
      <PageHeader title={`${year}년 ${month + 1}월`}>
        <div className="mt-4 flex items-center gap-1">
          <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="icon-btn border bg-sheet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="icon-btn border bg-sheet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {(!isCurrentMonth || selected !== todayStr) && (
            <button type="button" onClick={goToday} className="text-btn ml-2">
              오늘로
            </button>
          )}
        </div>
      </PageHeader>

      <div className="mb-8">
        <div className="grid grid-cols-7 border-b pb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[12px] font-medium text-pencil">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1">
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
                onClick={() => selectDay(dStr)}
                aria-pressed={isSelected}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? " 오늘" : ""}${hasEvents ? ", 일정 있음" : ""}${hasTodos ? ", 할 일 있음" : ""}`}
                className="relative mx-auto grid h-11 w-11 place-items-center rounded-full text-[15px] transition-colors"
                style={{
                  background: isSelected ? "var(--navy)" : isToday ? "var(--mint-soft)" : "transparent",
                  color: isSelected ? "var(--paper)" : isToday ? "var(--navy)" : "var(--ink)",
                  fontWeight: isSelected || isToday ? 700 : 400,
                }}
              >
                <span className="leading-none">{date.getDate()}</span>
                {/* 점은 숫자 정렬에 끼지 않게 원 바닥에 따로 띄움 */}
                <span className="absolute bottom-1.5 left-1/2 flex h-1 -translate-x-1/2 gap-[3px]">
                  {hasEvents && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? "var(--paper)" : "var(--navy)" }}
                    />
                  )}
                  {hasTodos && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? "var(--mint)" : "var(--teal)" }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end gap-4 text-[12px] text-pencil">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-navy" />
            일정
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />할 일
          </span>
        </div>
      </div>

      <h2 className="section-head" data-tone="navy">
        <span>{selectedLabel}</span>
        {selected === todayStr && <span className="aside">오늘</span>}
      </h2>

      <form onSubmit={add} className="composer mt-4 space-y-3">
        <label htmlFor="new-entry" className="composer-label">
          {kind === "event" ? "일정 추가" : "이날 할 일 추가"}
        </label>
        <div className="flex items-center gap-3">
          <input
            id="new-entry"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "event" ? "일정 이름" : "할 일"}
            className="composer-input"
          />
          <button type="submit" aria-label="추가" className="add-btn">
            <AddIcon />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {(
            [
              ["event", "일정"],
              ["todo", "할 일"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className="chip"
            >
              {label}
            </button>
          ))}
        </div>
        {kind === "event" && <ScheduleFields value={schedule} onChange={setSchedule} />}
      </form>

      {isEmpty && <p className="empty">이날은 비어 있어요.</p>}

      {selectedEvents.length > 0 && (
        <>
          <GroupTitle color="var(--navy)">일정</GroupTitle>
          <ul>
            {selectedEvents.map((e) => (
              <li key={eventKey(e)} className="row">
                {editingId === e.id ? (
                  <EventEditor
                    event={e}
                    onSave={(nextTitle, next) => saveEvent(e.id, nextTitle, next)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <span className="w-[4.5rem] flex-none text-[13px] font-semibold leading-tight text-navy">
                      {timeLabelOn(e, selected)}
                    </span>
                    <span className="min-w-0 flex-1">
                      {e.title}
                      {e.repeat && (
                        <span className="ml-1.5 rounded-full bg-navy-soft px-1.5 py-0.5 align-middle text-[11px] text-navy">
                          {REPEAT_LABEL[e.repeat]}
                        </span>
                      )}
                      {isMultiDay(e) && <span className="block text-[12px] text-pencil">{rangeLabel(e)}</span>}
                    </span>
                    <EditButton onClick={() => setEditingId(e.id)} />
                    <DeleteButton onClick={() => removeEvent(e)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedTodos.length > 0 && (
        <>
          <GroupTitle color="var(--ink)">할 일</GroupTitle>
          <ul>
            {selectedTodos.map((t) => (
              <li key={t.id} className="row">
                {editingId === t.id ? (
                  <TodoEditor
                    todo={t}
                    onSave={(nextTitle, date) => saveTodo(t.id, nextTitle, date)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <LedgerCheck checked={t.done} onChange={() => toggleTodo(t.id, t.done)}>
                      {t.title}
                    </LedgerCheck>
                    <EditButton onClick={() => setEditingId(t.id)} />
                    <DeleteButton onClick={() => removeTodo(t)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedRecurring.length > 0 && (
        <>
          <GroupTitle color="var(--blue)" aside={`${recurringDoneCount} / ${selectedRecurring.length}`}>
            반복
          </GroupTitle>
          <ul>
            {selectedRecurring.map((r) => (
              <li key={r.id} className="row">
                <LedgerCheck checked={r.done} onChange={() => toggleRecurring(r.id, r.done)} tone="blue">
                  {r.title}
                </LedgerCheck>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
