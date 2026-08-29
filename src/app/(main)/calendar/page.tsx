"use client";

import { useEffect, useMemo, useState } from "react";

type Event = {
  id: string;
  title: string;
  event_date: string;
};

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

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(toDateStr(today));
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const todayStr = toDateStr(today);

  async function load() {
    const rangeStart = toDateStr(new Date(year, month, 1));
    const rangeEnd = toDateStr(new Date(year, month + 1, 0));
    const res = await fetch(`/api/events?start=${rangeStart}&end=${rangeEnd}`);
    const data = await res.json();
    setEvents(data.events ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const e of events) {
      (map[e.event_date] ??= []).push(e);
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDate[selected] ?? [];

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), eventDate: selected }),
    });
    setTitle("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    load();
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
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(dStr)}
                className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors"
                style={{
                  background: isSelected ? "var(--accent)" : "transparent",
                  color: isSelected ? "#fff" : "var(--text)",
                  boxShadow: !isSelected && isToday ? "inset 0 0 0 1.5px var(--accent-2)" : "none",
                }}
              >
                {date.getDate()}
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    background: hasEvents ? (isSelected ? "#fff" : "var(--accent)") : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-xl border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {selectedLabel}
        </h2>

        <form onSubmit={addEvent} className="mb-4 flex items-end gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 등록"
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
        </form>

        {selectedEvents.length > 0 ? (
          <ul className="space-y-2">
            {selectedEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{e.title}</span>
                <button
                  onClick={() => remove(e.id)}
                  aria-label="삭제"
                  className="grid h-6 w-6 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted">
            등록된 일정 없음
          </p>
        )}
      </section>
    </div>
  );
}
