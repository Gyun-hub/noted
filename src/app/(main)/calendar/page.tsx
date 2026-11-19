"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { AddIcon, PageHeader } from "@/components/page";
import { ScheduleFields, emptySchedule, scheduleToBody, type Schedule } from "@/components/schedule-fields";
import { runsOn } from "@/components/weekday-picker";
import { getJson, send } from "@/lib/api";
import { ListSkeleton } from "@/components/skeleton";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useLocalCache } from "@/lib/local-cache";
import {
  DEFAULT_CATEGORIES,
  REPEAT_LABEL,
  endDateOf,
  eventKey,
  formatEventTitle,
  getCategoryStyle,
  isMultiDay,
  parseEventTitle,
  rangeLabel,
  shortTime,
  timeLabelOn,
  type EventRow,
} from "@/lib/events";
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

type MonthCache = { events: EventRow[]; todos: Todo[]; recurring: RecurringTodo[]; logs: RecurringLog[] };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 날짜 아래 제목이 여러 개면 이 간격으로 다음 것으로 넘김
const TICKER_MS = 3000;

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

/** "2026-10-31" -> "10월 31일 (토)" */
function dayLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function renderNoteWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule underline-offset-4 hover:decoration-blue break-all font-medium text-navy"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function EventDetail({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const parsed = parseEventTitle(event.title);
  const catStyle = getCategoryStyle(parsed.category);
  const start = shortTime(event.event_time);
  const end = shortTime(event.end_time);
  const rows: [string, string][] = isMultiDay(event)
    ? [
        ["시작", [dayLabel(event.event_date), start].filter(Boolean).join(" ")],
        ["끝", [dayLabel(endDateOf(event)), end].filter(Boolean).join(" ")],
      ]
    : [
        ["날짜", dayLabel(event.event_date)],
        ["시간", start && end ? `${start} – ${end}` : start || "종일"],
      ];
  if (event.repeat) {
    rows.push(["반복", `${REPEAT_LABEL[event.repeat]}${event.repeat_until ? ` · ${dayLabel(event.repeat_until)}까지` : ""}`]);
    if (event.series) rows.push(["첫 회", dayLabel(event.series.event_date)]);
  }

  return (
    <div className="w-full py-2">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
        >
          {parsed.category}
        </span>
        <p className="text-[17px] font-semibold">{parsed.cleanTitle}</p>
      </div>
      <dl className="mt-3 space-y-1 text-[14px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-10 flex-none text-pencil">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {parsed.note && (
        <div className="mt-3 rounded-xl border bg-sheet p-3">
          <p className="mb-1 text-[12px] font-semibold text-pencil">내용 및 메모</p>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {renderNoteWithLinks(parsed.note)}
          </div>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onClose} className="h-8 px-2 text-[13px] text-pencil hover:text-ink">
          닫기
        </button>
      </div>
    </div>
  );
}

function DetailButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="상세" className="icon-btn">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </button>
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
  const [category, setCategory] = useState<string>("개인");
  const [note, setNote] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [kind, setKind] = useState<Kind>("event");
  const [schedule, setSchedule] = useState<Schedule>(() => emptySchedule(todayStr));
  // 수정 중인 일정/할 일 id. 있으면 아래 입력 폼이 수정 폼이 됨
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todoDate, setTodoDate] = useState(todayStr);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [tick, setTick] = useState(0);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const monthStart = toDateStr(new Date(year, month, 1));
  const monthEnd = toDateStr(new Date(year, month + 1, 0));

  // 마지막으로 본 달은 이 기기에 저장해 두고 먼저 보여줌. loadedMonth = 지금 화면 데이터가 어느 달 것인지
  const monthKey = monthStart.slice(0, 7);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const monthReady = loadedMonth === monthKey;
  const cache = useLocalCache<MonthCache>(
    CACHE_KEYS.calendar,
    monthKey,
    monthReady ? { events, todos, recurring, logs } : null,
    (cached) => {
      setEvents(cached.events);
      setTodos(cached.todos);
      setRecurring(cached.recurring);
      setLogs(cached.logs);
      setLoadedMonth(monthKey);
    },
  );

  async function load() {
    const key = monthKey;
    const range = `start=${monthStart}&end=${monthEnd}`;
    const [eventsData, todosData] = await Promise.all([
      getJson<{ events: EventRow[] }>(`/api/events?${range}`),
      getJson<{ todos: Todo[]; recurring: RecurringTodo[]; logs: RecurringLog[] }>(`/api/todos?${range}`),
    ]);
    if (!eventsData || !todosData) return;
    cache.markFresh();
    setEvents(eventsData.events ?? []);
    setTodos(todosData.todos ?? []);
    setRecurring(todosData.recurring ?? []);
    setLogs(todosData.logs ?? []);
    setLoadedMonth(key);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICKER_MS);
    return () => clearInterval(id);
  }, []);

  // 홈 화면에서 /calendar?date=YYYY-MM-DD 로 들어오면 그 날을 선택
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const [y, m] = date.split("-").map(Number);
    setCursor(new Date(y, m - 1, 1));
    setSelected(date);
    setSchedule(emptySchedule(date));
    setSheetOpen(true);
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheetOpen && !sheet.open) sheet.showModal();
    if (!sheetOpen && sheet.open) sheet.close();
  }, [sheetOpen]);

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

  const allCategories = useMemo(() => {
    const set = new Set<string>(["개인", "공모전", "업무"]);
    for (const e of events) {
      const parsed = parseEventTitle(e.title);
      if (parsed.category) set.add(parsed.category);
    }
    return ["전체", ...Array.from(set)];
  }, [events]);

  const selectedAllEvents = eventsByDate[selected] ?? [];
  const selectedEvents =
    activeCategory === "전체"
      ? selectedAllEvents
      : selectedAllEvents.filter((e) => parseEventTitle(e.title).category === activeCategory);
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
    resetComposer(date);
    setDetailId(null);
  }

  function resetComposer(date = selected) {
    setTitle("");
    setCategory("개인");
    setNote("");
    setSchedule(emptySchedule(date));
    setEditingId(null);
  }

  function editEvent(event: EventRow) {
    const parsed = parseEventTitle(event.title);
    setDetailId(null);
    setEditingId(event.id);
    setKind("event");
    setCategory(parsed.category);
    setTitle(parsed.cleanTitle);
    setNote(parsed.note);
    setSchedule(eventToSchedule(event));
    focusComposer();
  }

  function editTodo(todo: Todo) {
    setDetailId(null);
    setEditingId(todo.id);
    setKind("todo");
    setTitle(todo.title);
    setTodoDate(todo.due_date);
    focusComposer();
  }

  function focusComposer() {
    const input = document.getElementById("new-entry");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }

  function openDay(date: string) {
    selectDay(date);
    setSheetOpen(true);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;

    let ok: boolean;
    if (kind === "event") {
      const fullTitle = formatEventTitle(category, name, note);
      const parsed = scheduleToBody(schedule);
      if (parsed.error) return showToast(parsed.error, { tone: "error" });
      ok = editingId
        ? await send(`/api/events/${editingId}`, "PATCH", { title: fullTitle, ...parsed.body })
        : await send("/api/events", "POST", { title: fullTitle, ...parsed.body });
    } else if (editingId) {
      if (!todoDate) return;
      ok = await send(`/api/todos/${editingId}`, "PATCH", { title: name, dueDate: todoDate });
    } else {
      ok = await send("/api/todos", "POST", { title: name, dueDate: selected });
    }
    if (!ok) return;
    resetComposer();
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

      {/* 구분값 필터 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {allCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            aria-pressed={activeCategory === cat}
            className="chip h-7 px-3 text-[12px]"
          >
            {cat}
          </button>
        ))}
      </div>

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
            const dayAllEvents = eventsByDate[dStr] ?? [];
            const dayEvents =
              activeCategory === "전체"
                ? dayAllEvents
                : dayAllEvents.filter((e) => parseEventTitle(e.title).category === activeCategory);
            const dayTodos =
              activeCategory === "전체" || activeCategory === "개인"
                ? (todosByDate[dStr] ?? []).filter((t) => !t.done)
                : [];
            const hasEvents = dayEvents.length > 0;
            const hasTodos = dayTodos.length > 0;
            const labels = [
              ...dayEvents.map((e) => {
                const parsed = parseEventTitle(e.title);
                const catStyle = getCategoryStyle(parsed.category);
                return {
                  title: parsed.cleanTitle,
                  color: catStyle.color,
                };
              }),
              ...dayTodos.map((t) => ({ title: t.title, color: "var(--teal)" })),
            ];
            const shown = labels.length > 0 ? tick % labels.length : 0;
            const label = labels[shown];
            return (
              <button
                key={i}
                type="button"
                onClick={() => openDay(dStr)}
                aria-pressed={isSelected}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? " 오늘" : ""}${hasEvents ? ", 일정 있음" : ""}${hasTodos ? ", 할 일 있음" : ""}`}
                className="flex min-w-0 flex-col items-center gap-0.5 pb-1"
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-[15px] leading-none transition-colors"
                  style={{
                    background: isSelected ? "var(--navy)" : isToday ? "var(--mint-soft)" : "transparent",
                    color: isSelected ? "var(--paper)" : isToday ? "var(--navy)" : "var(--ink)",
                    fontWeight: isSelected || isToday ? 700 : 400,
                  }}
                >
                  {date.getDate()}
                </span>
                {/* 제목 한 줄. 여러 개면 TICKER_MS마다 위로 밀려 올라오며 바뀜 */}
                <span className="h-[14px] w-full overflow-hidden px-0.5 text-center text-[10px] leading-[14px]" aria-hidden="true">
                  {label && (
                    <span
                      key={shown}
                      data-roll={labels.length > 1 ? "" : undefined}
                      className="day-ticker block truncate"
                      style={{ color: label.color }}
                    >
                      {label.title}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-3 text-[12px] text-pencil">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--navy)" }} />
            개인
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--purple, #7c3aed)" }} />
            공모전
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--blue)" }} />
            업무
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal)" }} />
            할 일
          </span>
        </div>
      </div>

      <dialog
        ref={sheetRef}
        className="day-sheet"
        aria-label={selectedLabel}
        onClose={() => {
          setSheetOpen(false);
          resetComposer();
          setDetailId(null);
        }}
        // 시트 바깥(배경)을 누르면 닫힘. 안쪽 클릭은 div가 받음
        onClick={(e) => e.target === e.currentTarget && setSheetOpen(false)}
      >
        <div className="day-sheet-body">
          <h2 className="section-head" data-tone="navy" style={{ alignItems: "center" }}>
            <span>{selectedLabel}</span>
            <span className="flex items-center gap-2">
              {selected === todayStr && <span className="aside">오늘</span>}
              <button type="button" aria-label="닫기" onClick={() => setSheetOpen(false)} className="icon-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          </h2>

          {!monthReady ? <ListSkeleton rows={2} /> : isEmpty && <p className="empty">이날은 비어 있어요.</p>}

          {selectedEvents.length > 0 && (
            <>
              <GroupTitle color="var(--navy)">일정</GroupTitle>
              <ul>
                {selectedEvents.map((e) => {
                  const parsed = parseEventTitle(e.title);
                  const catStyle = getCategoryStyle(parsed.category);
                  return (
                    <li key={eventKey(e)} className="row" data-editing={editingId === e.id || undefined}>
                      {detailId === eventKey(e) ? (
                        <EventDetail event={e} onClose={() => setDetailId(null)} />
                      ) : (
                        <>
                          <span className="w-[4.5rem] flex-none text-[13px] font-semibold leading-tight text-navy">
                            {timeLabelOn(e, selected)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className="mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold align-middle"
                              style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
                            >
                              {parsed.category}
                            </span>
                            <span className="font-medium">{parsed.cleanTitle}</span>
                            {parsed.note && <span className="ml-1 text-[11px] text-pencil" title="메모 있음">📝</span>}
                            {e.repeat && (
                              <span className="ml-1.5 rounded-full bg-navy-soft px-1.5 py-0.5 align-middle text-[11px] text-navy">
                                {REPEAT_LABEL[e.repeat]}
                              </span>
                            )}
                            {isMultiDay(e) && <span className="block text-[12px] text-pencil">{rangeLabel(e)}</span>}
                          </span>
                          <DetailButton onClick={() => setDetailId(eventKey(e))} />
                          <EditButton onClick={() => editEvent(e)} />
                          <DeleteButton onClick={() => removeEvent(e)} />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {selectedTodos.length > 0 && (
            <>
              <GroupTitle color="var(--ink)">할 일</GroupTitle>
              <ul>
                {selectedTodos.map((t) => (
                  <li key={t.id} className="row" data-editing={editingId === t.id || undefined}>
                    <LedgerCheck checked={t.done} onChange={() => toggleTodo(t.id, t.done)}>
                      {t.title}
                    </LedgerCheck>
                    <EditButton onClick={() => editTodo(t)} />
                    <DeleteButton onClick={() => removeTodo(t)} />
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

          <form onSubmit={add} className="composer mt-6 space-y-3" style={{ marginBottom: 0 }}>
            <label htmlFor="new-entry" className="composer-label">
              {editingId ? (kind === "event" ? "일정 수정" : "할 일 수정") : kind === "event" ? "일정 추가" : "이날 할 일 추가"}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="new-entry"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "event" ? (category === "공모전" ? "공모전 이름" : "일정 이름") : "할 일"}
                className="composer-input"
              />
              {editingId ? (
                <EditActions onCancel={() => resetComposer()} />
              ) : (
                <button type="submit" aria-label="추가" className="add-btn">
                  <AddIcon />
                </button>
              )}
            </div>
            {kind === "event" && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-pencil flex-none">구분:</span>
                  <div className="flex flex-wrap gap-1">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        aria-pressed={category === c}
                        className="chip h-6 px-2 text-[11px]"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="내용, 해야 할 것들, 링크 (선택)"
                  aria-label="내용 및 메모"
                  className="field field-sm resize-none"
                />
              </div>
            )}
            {editingId ? (
              kind === "todo" && (
                <div className="border-t pt-3">
                  <input
                    type="date"
                    value={todoDate}
                    onChange={(e) => setTodoDate(e.target.value)}
                    aria-label="날짜"
                    className="field field-sm w-auto"
                  />
                </div>
              )
            ) : (
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
            )}
            {kind === "event" && editingId && events.find((e) => e.id === editingId)?.repeat && (
              <p className="text-[12px] text-pencil">반복 일정은 모든 회차가 함께 바뀌어요</p>
            )}
            {kind === "event" && <ScheduleFields value={schedule} onChange={setSchedule} />}
          </form>
        </div>
      </dialog>
    </>
  );
}
