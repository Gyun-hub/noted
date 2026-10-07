"use client";

import { useEffect, useRef, useState } from "react";
import { LedgerCheck } from "@/components/ledger-check";
import { DeleteButton, EditActions, EditButton, InlineEdit } from "@/components/inline-edit";
import { WeekdayPicker, runsOn, weekdaysLabel } from "@/components/weekday-picker";
import { RecurringHistory, STREAK_WINDOW, addDays } from "@/components/recurring-history";
import { AddIcon, PageHeader, Section } from "@/components/page";
import { getJson, send } from "@/lib/api";
import { ListSkeleton } from "@/components/skeleton";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useLocalCache } from "@/lib/local-cache";
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

type TodosResponse = { recurring: RecurringTodo[]; oneOff: Todo[] };
type TodayCache = { recurring: RecurringTodo[]; oneOff: Todo[] };
type HistoryResponse = { logs: { todo_id: string; log_date: string; done: boolean }[] };

const UNDO_MS = 4000;

function toDateStr(d: Date) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function todayLabel() {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
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
      className="w-full space-y-3 py-2"
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      <div className="flex justify-end">
        <EditActions onCancel={onCancel} />
      </div>
    </form>
  );
}

export default function TodayPage() {
  const [recurring, setRecurring] = useState<RecurringTodo[]>([]);
  const [oneOff, setOneOff] = useState<Todo[]>([]);
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

  // 처음엔 이 기기에 저장해 둔 오늘 목록을 먼저 보여주고, 받아오면 최신으로 (날짜가 바뀌면 안 씀)
  const [loaded, setLoaded] = useState(false);
  const cache = useLocalCache<TodayCache>(
    CACHE_KEYS.today,
    date,
    loaded ? { recurring, oneOff } : null,
    (cached) => {
      setRecurring(cached.recurring);
      setOneOff(cached.oneOff);
      setLoaded(true);
    },
  );

  async function load() {
    const todosData = await getJson<TodosResponse>(`/api/todos?date=${date}`);
    if (!todosData) return;
    cache.markFresh();
    setRecurring(todosData.recurring ?? []);
    setOneOff(todosData.oneOff ?? []);
    setLoaded(true);
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
      isRecurring ? { title: title.trim(), isRecurring, weekdays } : { title: title.trim() },
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
      undoToast.current = showToast(`"${todo.title}" 완료`, {
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
  const allRecurringDone = todayRecurring.length > 0 && doneCount === todayRecurring.length;
  const openOneOff = oneOff.filter((t) => !t.done).length;
  const leftCount = openOneOff + todayRecurring.length - doneCount;

  return (
    <>
      <PageHeader title={todayLabel()} sub={!loaded ? "\u00a0" : leftCount > 0 ? `남은 일 ${leftCount}개` : "오늘 할 일을 모두 끝냈어요"}>
        {allRecurringDone && (
          <div className="pointer-events-none absolute right-5 top-24" role="img" aria-label="오늘 반복 완료">
            <span className="stamp">
              참<br />
              잘했어요
            </span>
          </div>
        )}
      </PageHeader>

      <form onSubmit={addTodo} className="composer space-y-3">
        <label htmlFor="new-todo" className="composer-label">
          할 일 추가
        </label>
        <div className="flex items-center gap-3">
          <input
            id="new-todo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isRecurring ? "매일 또는 요일마다 할 일" : "해야 할 일을 적어두세요"}
            className="composer-input"
          />
          <button type="submit" aria-label="추가" className="add-btn">
            <AddIcon />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <button
            type="button"
            onClick={() => setIsRecurring((v) => !v)}
            aria-pressed={isRecurring}
            data-tone="blue"
            className="chip"
          >
            반복
          </button>
          {isRecurring ? (
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          ) : (
            <span className="text-[13px] text-pencil">반복을 켜면 요일을 고를 수 있어요</span>
          )}
        </div>
      </form>

      {todayRecurring.length > 0 && (
        <Section title="반복" tone="blue" aside={`${doneCount} / ${todayRecurring.length}`}>
          <ul>
            {todayRecurring.map((t) => (
              <li key={t.id} className="row">
                <LedgerCheck checked={t.done} onChange={() => toggleRecurring(t.id, t.done)} tone="blue">
                  {t.title}
                </LedgerCheck>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="할 일" aside={oneOff.length > 0 ? `${openOneOff}개` : undefined}>
        {oneOff.length > 0 ? (
          <ul>
            {oneOff.map((t) => (
              <li key={t.id} className="row">
                {editingId === t.id ? (
                  <InlineEdit
                    value={t.title}
                    onSave={(next) => renameOneOff(t.id, next)}
                    onCancel={() => setEditingId(null)}
                    className="flex-1"
                  />
                ) : (
                  <>
                    <LedgerCheck checked={t.done} onChange={() => toggleOneOff(t)}>
                      {t.title}
                      {t.due_date && t.due_date < date && (
                        <span className="ml-2 whitespace-nowrap rounded bg-navy-soft px-1.5 py-0.5 text-[11px] font-semibold text-navy">
                          {Number(t.due_date.slice(5, 7))}/{Number(t.due_date.slice(8))}부터
                        </span>
                      )}
                    </LedgerCheck>
                    <EditButton onClick={() => setEditingId(t.id)} />
                    <DeleteButton onClick={() => removeOneOff(t)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          loaded ? <p className="empty">남은 할 일이 없어요. 위 입력칸에 새로 적어보세요.</p> : <ListSkeleton />
        )}
      </Section>

      {recurring.length > 0 && (
        <details
          className="group"
          onToggle={(e) => {
            if (e.currentTarget.open && !history) loadHistory();
          }}
        >
          <summary className="section-head cursor-pointer list-none" style={{ borderBottomColor: "var(--rule)" }}>
            <span className="text-pencil">반복 관리</span>
            <span className="aside flex items-center gap-1">
              {recurring.length}개
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="transition-transform group-open:rotate-180"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <ul>
            {recurring.map((t) => (
              <li key={t.id} className="border-b py-3">
                {editingId === t.id ? (
                  <RecurringEditor
                    todo={t}
                    onSave={(next, nextWeekdays) => saveRecurring(t.id, next, nextWeekdays)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        {t.title}
                        <span className="ml-2 text-[13px] text-blue">{weekdaysLabel(t.weekdays)}</span>
                      </span>
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
    </>
  );
}
