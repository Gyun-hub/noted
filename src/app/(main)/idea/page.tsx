"use client";

import { useEffect, useState } from "react";
import { getJson, send } from "@/lib/api";
import { ListSkeleton } from "@/components/skeleton";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useLocalCache } from "@/lib/local-cache";
import { showToast } from "@/lib/toast";
import { DeleteButton, EditActions, EditButton, InlineEdit } from "@/components/inline-edit";
import { PageHeader, Section } from "@/components/page";
import { ToolsPanel } from "./tools-panel";

type View = "ideas" | "tools";

const VIEWS: [View, string][] = [
  ["ideas", "아이디어"],
  ["tools", "써볼 도구"],
];

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
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
}

export default function IdeaPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertDate, setConvertDate] = useState("");
  const [view, setView] = useState<View>("ideas");

  // 검색 결과에서 /idea?view=tools 로 들어오면 도구 쪽을 보여줌
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") !== "tools") return;
    Promise.resolve().then(() => setView("tools"));
  }, []);

  // 처음엔 이 기기에 저장해 둔 목록을 먼저 보여주고, 받아오면 최신으로
  const [loaded, setLoaded] = useState(false);
  const cache = useLocalCache<Idea[]>(CACHE_KEYS.ideas, "", loaded ? ideas : null, (cached) => {
    setIdeas(cached);
    setLoaded(true);
  });

  async function load() {
    const data = await getJson<{ ideas: Idea[] }>("/api/ideas");
    if (!data) return;
    cache.markFresh();
    setIdeas(data.ideas ?? []);
    setLoaded(true);
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

  async function remove(idea: Idea) {
    if (!confirm("이 아이디어를 지울까요?")) return;
    setIdeas((list) => list.filter((i) => i.id !== idea.id));
    if (!(await send(`/api/ideas/${idea.id}`, "DELETE"))) load();
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
    showToast(`${shortDate(convertDate)} 할 일로 추가했어요`);
  }

  return (
    <>
      <PageHeader
        title="아이디어"
        sub={
          view === "tools"
            ? "써보고 싶은 플러그인·도구"
            : !loaded
              ? "\u00a0"
              : ideas.length > 0
                ? `${ideas.length}개 적어둠`
                : "떠오른 걸 바로 적어두세요"
        }
      />

      <div className="mb-6 flex gap-1 rounded-full bg-grid p-1" role="tablist">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className="h-8 flex-1 rounded-full text-[13px] font-medium transition-colors"
            style={view === value ? { background: "var(--sheet)", color: "var(--navy)" } : { color: "var(--pencil)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "tools" ? (
        <ToolsPanel />
      ) : (
        <>

      <form onSubmit={addIdea} className="composer">
        <label htmlFor="new-idea" className="composer-label">
          아이디어 적기
        </label>
        <textarea
          id="new-idea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addIdea(e);
          }}
          placeholder="만들고 싶은 것, 해보고 싶은 것"
          rows={3}
          className="composer-input resize-none"
        />
        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <span className="text-[13px] text-pencil">첫 줄이 제목이 돼요</span>
          <button type="submit" className="h-9 rounded-full bg-navy px-5 text-sm font-semibold text-paper">
            저장
          </button>
        </div>
      </form>

      <Section title="적어둔 것" aside={ideas.length > 0 ? `${ideas.length}개` : undefined}>
        {ideas.length > 0 ? (
          <ul>
            {ideas.map((idea) => {
              const [first, ...rest] = idea.content.split("\n");
              const body = rest.join("\n").trim();
              return (
                <li key={idea.id} className="border-b py-4">
                  {editingId === idea.id ? (
                    <InlineEdit
                      value={idea.content}
                      multiline
                      onSave={(next) => saveEdit(idea.id, next)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <p className="font-semibold">{first}</p>
                      {body && <p className="mt-1 whitespace-pre-wrap text-sm text-pencil">{body}</p>}
                      <div className="mt-2 flex items-center gap-1">
                        <time className="flex-1 text-[12px] text-pencil">{formatDate(idea.created_at)}</time>
                        <button
                          type="button"
                          onClick={() => startConvert(idea.id)}
                          className="h-8 rounded-full px-3 text-[13px] font-medium text-blue hover:bg-blue-soft"
                        >
                          할 일로
                        </button>
                        <EditButton onClick={() => setEditingId(idea.id)} />
                        <DeleteButton onClick={() => remove(idea)} />
                      </div>
                    </>
                  )}
                  {convertingId === idea.id && (
                    <form
                      onSubmit={(e) => convertToTodo(e, idea)}
                      onKeyDown={(e) => e.key === "Escape" && setConvertingId(null)}
                      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-blue-soft p-3"
                    >
                      <label htmlFor={`convert-${idea.id}`} className="text-[13px] font-medium text-blue">
                        언제 할까요?
                      </label>
                      <input
                        id={`convert-${idea.id}`}
                        type="date"
                        required
                        value={convertDate}
                        onChange={(e) => setConvertDate(e.target.value)}
                        className="field field-sm min-w-[9rem] flex-1"
                      />
                      <EditActions onCancel={() => setConvertingId(null)} saveLabel="추가" />
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          loaded ? <p className="empty">아직 적어둔 아이디어가 없어요.</p> : <ListSkeleton rows={3} />
        )}
      </Section>
        </>
      )}
    </>
  );
}
