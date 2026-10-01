"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { PageHeader, Section } from "@/components/page";
import { runsOn } from "@/components/weekday-picker";
import { addDays } from "@/components/recurring-history";
import { getJson, send } from "@/lib/api";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { readCache, writeCache } from "@/lib/local-cache";
import { REPEAT_LABEL, endDateOf, eventKey, monthDay, rangeLabel, timeLabelOn, type EventRow } from "@/lib/events";

type Todo = { id: string; title: string; done: boolean; due_date: string | null };
type RecurringTodo = { id: string; title: string; done: boolean; weekdays: number[] | null };
type Product = { id: string; name: string; done: boolean; store: string | null };
type Idea = { id: string; content: string; created_at: string };

type Dashboard = {
  recurring: RecurringTodo[];
  oneOff: Todo[];
  weekTodos: Todo[];
  events: EventRow[];
  products: Product[];
  ideas: Idea[];
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 이만큼 옆으로 밀어야 주가 넘어감 (px)
const SWIPE_MIN = 50;

type WeekView = { start: string; events: EventRow[]; todos: Todo[] };

/**
 * 주 목록 메모리 캐시. 홈을 나갔다 와도 남아 있어 바로 보임.
 * 보여줄 땐 캐시를 먼저 쓰고 뒤에서 다시 받아 바뀐 게 있으면 고침 (stale-while-revalidate)
 */
const weekCache = new Map<string, WeekView>();

/** 실패하면 null. 빈 목록을 캐시해 "일정 없음"으로 보이지 않게 */
async function loadWeek(start: string): Promise<WeekView | null> {
  const end = addDays(start, 6);
  const [eventsData, todosData] = await Promise.all([
    getJson<{ events: EventRow[] }>(`/api/events?start=${start}&end=${end}`),
    getJson<{ todos: Todo[] }>(`/api/todos?start=${start}&end=${end}`),
  ]);
  if (!eventsData || !todosData) return null;
  const view = { start, events: eventsData.events ?? [], todos: todosData.todos ?? [] };
  weekCache.set(start, view);
  return view;
}

function weekTitle(offset: number) {
  if (offset === 0) return "이번 주";
  if (offset === -1) return "지난주";
  if (offset === 1) return "다음 주";
  return offset < 0 ? `${-offset}주 전` : `${offset}주 뒤`;
}
// 이번 주 뒤로 며칠까지 "다가오는 일정"으로 보여줄지
const UPCOMING_DAYS = 30;

function toDateStr(d: Date) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** 월요일 시작 주 */
function weekStartOf(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

function greeting(hour: number) {
  if (hour < 6) return "늦은 밤이에요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function StatCard({
  href,
  label,
  value,
  unit,
  note,
  tone,
}: {
  href: string;
  label: string;
  value: number | string;
  unit?: string;
  note?: string;
  tone: "navy" | "blue" | "teal" | "mint";
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border bg-sheet p-4 transition-transform active:scale-[0.98]"
      style={{ borderTop: `3px solid var(--${tone})` }}
    >
      <p className="text-[13px] text-pencil">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-pencil">{unit}</span>}
      </p>
      {note && <p className="mt-1 truncate text-[12px] text-pencil">{note}</p>}
    </Link>
  );
}

/** 하나라도 실패하면 null. 빈 목록을 화면과 캐시에 남기지 않게 */
async function loadDashboard(
  today: string,
  weekStart: string,
  weekEnd: string,
  upcomingEnd: string,
): Promise<Dashboard | null> {
  const [todayData, weekData, eventsData, productsData, ideasData] = await Promise.all([
    getJson<{ recurring: RecurringTodo[]; oneOff: Todo[] }>(`/api/todos?date=${today}`),
    getJson<{ todos: Todo[] }>(`/api/todos?start=${weekStart}&end=${weekEnd}`),
    getJson<{ events: EventRow[] }>(`/api/events?start=${weekStart}&end=${upcomingEnd}`),
    getJson<{ products: Product[] }>("/api/products"),
    getJson<{ ideas: Idea[] }>("/api/ideas"),
  ]);
  if (!todayData || !weekData || !eventsData || !productsData || !ideasData) return null;
  return {
    recurring: todayData?.recurring ?? [],
    oneOff: todayData?.oneOff ?? [],
    weekTodos: weekData?.todos ?? [],
    events: eventsData?.events ?? [],
    products: productsData?.products ?? [],
    ideas: ideasData?.ideas ?? [],
  };
}

/** 처음 열 때 데이터 오기 전 자리 잡기 */
function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-10 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border bg-sheet p-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-6 w-10" />
            <div className="skeleton mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="skeleton mb-2 h-4 w-20" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b py-3">
          <div className="skeleton h-11 w-11 rounded-xl" />
          <div className="skeleton h-3.5" style={{ width: `${40 + ((i * 23) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  // 이 화면에서 체크한 장보기 항목. 체크해도 바로 사라지지 않게
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const now = new Date();
  const today = toDateStr(now);
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const upcomingEnd = addDays(weekEnd, UPCOMING_DAYS);

  // 주 목록: 좌우로 밀거나 화살표로 지난주/다음 주. 0 = 이번 주
  const [weekOffset, setWeekOffset] = useState(0);
  const [slide, setSlide] = useState<"prev" | "next" | null>(null);
  const [weeks, setWeeks] = useState<Record<string, WeekView>>(() => Object.fromEntries(weekCache));
  // 캐시에 없는 주로 넘길 때 받아오는 중인 주. 다 받은 뒤에 넘어감
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const viewStart = addDays(weekStart, weekOffset * 7);
  const viewEnd = addDays(viewStart, 6);

  useEffect(() => {
    // 마지막으로 본 홈(오늘 것)을 먼저 보여주고, 최신을 받아 덮어씀. 늦게 온 캐시가 최신을 덮지 않게
    Promise.resolve().then(() => {
      const cachedData = readCache<Dashboard>(CACHE_KEYS.home, today);
      const cachedWeek = readCache<WeekView>(CACHE_KEYS.homeWeek, today);
      if (cachedData) setData((d) => d ?? cachedData);
      if (cachedWeek) setWeeks((w) => (w[cachedWeek.start] ? w : { ...w, [cachedWeek.start]: cachedWeek }));
    });
    loadDashboard(today, weekStart, weekEnd, upcomingEnd).then((d) => d && setData(d));
  }, [today, weekStart, weekEnd, upcomingEnd]);

  // 받은 데이터를 다음에 열 때 바로 보이게 저장
  useEffect(() => {
    if (data) writeCache(CACHE_KEYS.home, data, today);
  }, [data, today]);
  const thisWeek = weeks[weekStart];
  useEffect(() => {
    if (thisWeek) writeCache(CACHE_KEYS.homeWeek, thisWeek, today);
  }, [thisWeek, today]);

  // 보는 주는 항상 다시 받아 최신으로, 양옆 주는 캐시에 없을 때만 미리 받아 둠
  useEffect(() => {
    const store = (v: WeekView | null) => v && setWeeks((w) => ({ ...w, [v.start]: v }));
    loadWeek(viewStart).then((v) => {
      store(v);
      for (const start of [addDays(viewStart, -7), addDays(viewStart, 7)]) {
        if (!weekCache.has(start)) loadWeek(start).then(store);
      }
    });
  }, [viewStart]);

  function reload() {
    loadDashboard(today, weekStart, weekEnd, upcomingEnd).then((d) => d && setData(d));
    loadWeek(viewStart).then((v) => v && setWeeks((w) => ({ ...w, [v.start]: v })));
  }

  // 데이터가 있어야 넘어감: 캐시에 있으면 바로, 없으면 받아온 뒤. 실패하면 그대로
  async function moveWeek(delta: number) {
    const offset = delta === 0 ? 0 : weekOffset + delta;
    const target = addDays(weekStart, offset * 7);
    if (target === viewStart || pendingStart) return;

    if (!weeks[target]) {
      setPendingStart(target);
      const v = await loadWeek(target);
      setPendingStart(null);
      if (!v) return;
      setWeeks((w) => ({ ...w, [v.start]: v }));
    }
    setSlide(offset < weekOffset ? "prev" : "next");
    setWeekOffset(offset);
  }

  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  // 가로로 충분히, 세로보다 확실히 많이 밀었을 때만 (세로 스크롤과 구분)
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    moveWeek(dx < 0 ? 1 : -1);
  }

  // 홈에서 바로 체크. 실패하면 다시 불러와 되돌림. 체크한 항목은 새로고침 전까지 목록에 남음
  async function toggleRecurring(todo: RecurringTodo) {
    const done = !todo.done;
    setData((d) => d && { ...d, recurring: d.recurring.map((t) => (t.id === todo.id ? { ...t, done } : t)) });
    if (!(await send(`/api/recurring-todos/${todo.id}/log`, "PUT", { date: today, done }))) reload();
  }

  async function toggleTodo(todo: Todo) {
    const done = !todo.done;
    const flip = (list: Todo[]) => list.map((t) => (t.id === todo.id ? { ...t, done } : t));
    setData((d) => d && { ...d, oneOff: flip(d.oneOff), weekTodos: flip(d.weekTodos) });
    setWeeks((w) => {
      const next: Record<string, WeekView> = {};
      for (const [start, v] of Object.entries(w)) {
        next[start] = { ...v, todos: flip(v.todos) };
        weekCache.set(start, next[start]);
      }
      return next;
    });
    if (!(await send(`/api/todos/${todo.id}`, "PATCH", { done }))) reload();
  }

  async function toggleProduct(product: Product) {
    const done = !product.done;
    setTouched((s) => new Set(s).add(product.id));
    setData((d) => d && { ...d, products: d.products.map((p) => (p.id === product.id ? { ...p, done } : p)) });
    if (!(await send(`/api/products/${product.id}`, "PATCH", { done }))) reload();
  }

  const view = weeks[viewStart] ?? null;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(viewStart, i));
  // 첫 화면은 요약과 이번 주를 다 받은 뒤 한 번에 그림
  const ready = !!data && !!weeks[weekStart];

  // 기간 일정은 보는 주 안 모든 날짜에 펼침
  const week = (() => {
    const events: Record<string, EventRow[]> = {};
    const todos: Record<string, Todo[]> = {};
    if (!view) return { events, todos };
    const end = addDays(view.start, 6);
    for (const e of view.events) {
      const last = endDateOf(e) < end ? endDateOf(e) : end;
      for (let d = e.event_date > view.start ? e.event_date : view.start; d <= last; d = addDays(d, 1)) {
        (events[d] ??= []).push(e);
      }
    }
    for (const t of view.todos) if (t.due_date) (todos[t.due_date] ??= []).push(t);
    return { events, todos };
  })();

  const weekEventCount = (data?.events ?? []).filter((e) => e.event_date <= weekEnd && endDateOf(e) >= weekStart).length;
  // 반복 일정은 다음 회차 하나만
  const upcoming = (data?.events ?? [])
    .filter((e) => e.event_date > weekEnd)
    .filter((e, i, list) => list.findIndex((o) => o.id === e.id) === i)
    .slice(0, 4);

  const todayWeekday = now.getDay();
  const todayRecurring = (data?.recurring ?? []).filter((t) => runsOn(t.weekdays, todayWeekday));
  const recurringDone = todayRecurring.filter((t) => t.done).length;
  const remaining = (data?.oneOff.filter((t) => !t.done).length ?? 0) + todayRecurring.length - recurringDone;
  const overdue = (data?.oneOff ?? []).filter((t) => t.due_date && t.due_date < today).length;

  const toBuy = (data?.products ?? []).filter((p) => !p.done);
  const stores = new Set(toBuy.map((p) => p.store).filter(Boolean));
  // 살 것 목록: 구매처별, 미정은 맨 뒤. 이번 화면에서 체크한 것도 남겨둠
  const shopping = (() => {
    const groups = new Map<string, Product[]>();
    for (const p of data?.products ?? []) {
      if (p.done && !touched.has(p.id)) continue;
      const key = p.store ?? "";
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ko")));
  })();
  const latestIdea = data?.ideas[0]?.content.split("\n")[0];

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(now);

  return (
    <>
      <PageHeader title={greeting(now.getHours())} sub={dateLabel} />

      {!ready && <HomeSkeleton />}

      {ready && (
        <>
          <div className="mb-10 grid grid-cols-2 gap-3">
            <StatCard
              href="/today"
              label="남은 할 일"
              value={data ? remaining : "–"}
              unit="개"
              note={
                !data
                  ? undefined
                  : overdue > 0
                    ? `밀린 일 ${overdue}개`
                    : todayRecurring.length > 0
                      ? `반복 ${recurringDone}/${todayRecurring.length} 완료`
                      : remaining === 0
                        ? "다 끝냈어요"
                        : undefined
              }
              tone="navy"
            />
            <StatCard
              href="/calendar"
              label="이번 주 일정"
              value={data ? weekEventCount : "–"}
              unit="개"
              note={data && week.events[today] ? `오늘 ${week.events[today].length}개` : undefined}
              tone="blue"
            />
            <StatCard
              href="/product"
              label="살 것"
              value={data ? toBuy.length : "–"}
              unit="개"
              note={stores.size > 0 ? `${stores.size}곳에서` : undefined}
              tone="teal"
            />
            <StatCard
              href="/idea"
              label="아이디어"
              value={data ? data.ideas.length : "–"}
              unit="개"
              note={latestIdea}
              tone="mint"
            />
          </div>

          <Section
            title={weekTitle(weekOffset)}
            tone="navy"
            aside={
              <span className="flex items-center gap-1">
                {weekOffset !== 0 && (
                  <button type="button" onClick={() => moveWeek(0)} className="text-btn mr-1">
                    이번 주로
                  </button>
                )}
                <button type="button" aria-label="지난주" onClick={() => moveWeek(-1)} className="icon-btn h-7 w-7">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="tabular-nums">
                  {monthDay(viewStart)} – {monthDay(viewEnd)}
                </span>
                <button type="button" aria-label="다음 주" onClick={() => moveWeek(1)} className="icon-btn h-7 w-7">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </span>
            }
          >
            <ol
              key={viewStart}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="week-list"
              data-slide={slide ?? undefined}
              aria-busy={!!pendingStart}
              style={{ touchAction: "pan-y" }}
            >
              {weekDays.map((day) => {
                const events = week.events[day] ?? [];
                const todos = week.todos[day] ?? [];
                const isToday = day === today;
                const past = day < today;
                return (
                  <li key={day}>
                    <Link
                      href={`/calendar?date=${day}`}
                      className="flex gap-3 border-b py-3"
                      style={{ opacity: past ? 0.55 : 1 }}
                    >
                      <div
                        className="grid h-11 w-11 flex-none place-items-center rounded-xl text-center leading-tight"
                        style={
                          isToday
                            ? { background: "var(--navy)", color: "var(--paper)" }
                            : { background: "var(--grid)", color: weekdayOf(day) === 0 ? "#d9485f" : undefined }
                        }
                      >
                        <span>
                          <span className="block text-[11px]">{DAYS[weekdayOf(day)]}</span>
                          <span className="block text-[15px] font-semibold">{Number(day.slice(8))}</span>
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 self-center">
                        {events.length === 0 && todos.length === 0 && (
                          <p className="text-sm text-pencil">{isToday ? "오늘은 일정이 없어요" : "—"}</p>
                        )}
                        <ul className="space-y-1">
                          {events.map((e) => (
                            <li key={eventKey(e)} className="flex items-baseline gap-2 text-[15px]">
                              <span className="w-[5.5rem] flex-none text-[12px] tabular-nums text-blue">
                                {timeLabelOn(e, day)}
                              </span>
                              <span className="truncate font-medium">{e.title}</span>
                            </li>
                          ))}
                          {todos.map((t) => (
                            <li key={t.id} className="flex items-baseline gap-2 text-[15px]">
                              <span className="w-[5.5rem] flex-none text-[12px] text-teal">할 일</span>
                              <span className={`truncate ${t.done ? "text-pencil line-through" : ""}`}>{t.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section
            title="오늘 할 일"
            aside={
              <Link href="/today" className="text-btn">
                전체 보기
              </Link>
            }
          >
            {data && todayRecurring.length === 0 && data.oneOff.length === 0 && <p className="empty">할 일이 없어요</p>}
            <ul>
              {todayRecurring.map((t) => (
                <li key={t.id} className="row">
                  <LedgerCheck checked={t.done} onChange={() => toggleRecurring(t)} tone="blue" className="flex-1">
                    {t.title}
                  </LedgerCheck>
                  <span className="flex-none text-[12px] text-blue">반복</span>
                </li>
              ))}
              {data?.oneOff.map((t) => (
                <li key={t.id} className="row">
                  <LedgerCheck checked={t.done} onChange={() => toggleTodo(t)} className="flex-1">
                    {t.title}
                  </LedgerCheck>
                  {t.due_date && t.due_date < today && (
                    <span className="flex-none text-[12px] text-pencil">{monthDay(t.due_date)}부터</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="살 것"
            tone="blue"
            aside={
              <Link href="/product" className="text-btn">
                장보기로
              </Link>
            }
          >
            {data && shopping.length === 0 && <p className="empty">살 게 없어요</p>}
            {shopping.map(([store, items]) => (
              <div key={store || "none"} className="mt-3">
                <p className="text-[12px] font-semibold text-teal">{store || "구매처 미정"}</p>
                <ul>
                  {items.map((p) => (
                    <li key={p.id} className="row">
                      <LedgerCheck checked={p.done} onChange={() => toggleProduct(p)} className="flex-1">
                        {p.name}
                      </LedgerCheck>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          {upcoming.length > 0 && (
            <Section title="다가오는 일정" tone="blue">
              <ul>
                {upcoming.map((e) => (
                  <li key={eventKey(e)}>
                    <Link href={`/calendar?date=${e.event_date}`} className="row">
                      <span className="w-16 flex-none text-[13px] text-blue">{monthDay(e.event_date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        {(rangeLabel(e) || e.repeat) && (
                          <span className="block text-[12px] text-pencil">
                            {[e.repeat && `${REPEAT_LABEL[e.repeat]} 반복`, rangeLabel(e)].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="flex-none text-[12px] text-pencil">
                        D-{Math.round((Date.parse(e.event_date) - Date.parse(today)) / 86400000)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data && data.ideas.length > 0 && (
            <Section
              title="최근 아이디어"
              aside={
                <Link href="/idea" className="text-btn">
                  전체 {data.ideas.length}개
                </Link>
              }
            >
              <ul>
                {data.ideas.slice(0, 3).map((idea) => {
                  const [first, ...rest] = idea.content.split("\n");
                  return (
                    <li key={idea.id}>
                      <Link href="/idea" className="block border-b py-3">
                        <p className="truncate font-medium">{first}</p>
                        {rest.join(" ").trim() && (
                          <p className="mt-0.5 truncate text-[13px] text-pencil">{rest.join(" ").trim()}</p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}
