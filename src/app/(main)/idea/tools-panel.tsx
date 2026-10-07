"use client";

import { useEffect, useState } from "react";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { AddIcon, Section } from "@/components/page";
import { ListSkeleton } from "@/components/skeleton";
import { getJson, send } from "@/lib/api";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useLocalCache } from "@/lib/local-cache";
import { showToast } from "@/lib/toast";
import { DEFAULT_TOOL_KINDS, TOOL_STATUSES, TOOL_STATUS_LABEL, type Tool, type ToolStatus } from "@/lib/tools";

type Draft = { name: string; url: string; kind: string; note: string };

const KIND_LIST_ID = "tool-kinds";
const EMPTY: Draft = { name: "", url: "", kind: "", note: "" };

function fetchTools() {
  return getJson<{ tools: Tool[] }>("/api/tools");
}

/**
 * 링크 미리보기로 이름·설명 채우기. GitHub 제목 "GitHub - owner/repo: 설명" 은 이름과 설명으로 나눔
 */
async function readLink(url: string): Promise<{ name: string; note: string } | null> {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "가져오지 못했어요");
    const title: string = data.title ?? "";
    const github = title.match(/^GitHub - ([^:]+?)(?::\s*(.*))?$/);
    if (github) return { name: github[1].trim(), note: (github[2] ?? "").trim() };
    return { name: title.trim(), note: "" };
  } catch (err) {
    showToast(err instanceof Error ? err.message : "가져오지 못했어요", { tone: "error" });
    return null;
  }
}

function ToolFields({ draft, onChange, kinds }: { draft: Draft; onChange: (next: Draft) => void; kinds: string[] }) {
  const [reading, setReading] = useState(false);

  async function fill() {
    setReading(true);
    const found = await readLink(draft.url.trim());
    setReading(false);
    if (!found) return;
    onChange({
      ...draft,
      name: draft.name.trim() ? draft.name : found.name.slice(0, 100),
      note: draft.note.trim() ? draft.note : found.note.slice(0, 1000),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={draft.url}
          onChange={(e) => onChange({ ...draft, url: e.target.value })}
          placeholder="링크 (선택)"
          aria-label="링크"
          className="field field-sm min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={fill}
          disabled={!draft.url.trim() || reading}
          className="chip h-7 flex-none px-3 disabled:opacity-50"
        >
          {reading ? "읽는 중" : "이름 가져오기"}
        </button>
      </div>
      <div>
        <input
          value={draft.kind}
          onChange={(e) => onChange({ ...draft, kind: e.target.value })}
          list={KIND_LIST_ID}
          maxLength={30}
          placeholder="분류 (선택)"
          aria-label="분류"
          className="field field-sm"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...draft, kind: draft.kind === k ? "" : k })}
              aria-pressed={draft.kind === k}
              className="chip h-7 px-3"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        rows={2}
        maxLength={1000}
        placeholder="메모 (뭐 하는 건지, 왜 써보고 싶은지)"
        aria-label="메모"
        className="field field-sm resize-none"
      />
    </div>
  );
}

function ToolEditor({
  tool,
  kinds,
  onSave,
  onCancel,
}: {
  tool: Tool;
  kinds: string[];
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ name: tool.name, url: tool.url, kind: tool.kind, note: tool.note });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave(draft);
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="w-full space-y-3 py-2">
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        maxLength={100}
        aria-label="이름"
        className="field"
      />
      <ToolFields draft={draft} onChange={setDraft} kinds={kinds} />
      <div className="flex justify-end">
        <EditActions onCancel={onCancel} />
      </div>
    </form>
  );
}

function ToolItem({
  tool,
  onStatus,
  onEdit,
  onDelete,
}: {
  tool: Tool;
  onStatus: (status: ToolStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="py-3">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 leading-snug">
          {tool.url ? (
            <a href={tool.url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-rule underline-offset-4">
              {tool.name}
            </a>
          ) : (
            <span className="font-semibold">{tool.name}</span>
          )}
          {tool.kind && (
            <span className="ml-1.5 whitespace-nowrap rounded bg-navy-soft px-1.5 py-0.5 align-middle text-[11px] text-navy">
              {tool.kind}
            </span>
          )}
        </p>
        <EditButton onClick={onEdit} />
        <DeleteButton onClick={onDelete} />
      </div>
      {tool.note && <p className="mt-1 whitespace-pre-line text-[13px] text-pencil">{tool.note}</p>}
      <div className="mt-2 flex gap-1.5">
        {TOOL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => s !== tool.status && onStatus(s)}
            aria-pressed={tool.status === s}
            data-tone={s === "using" ? "blue" : undefined}
            className="chip h-6 px-2.5 text-[12px]"
          >
            {TOOL_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 써볼 도구 메모 (Claude 플러그인·MCP·스킬 등) */
export function ToolsPanel() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const cache = useLocalCache<Tool[]>(CACHE_KEYS.tools, "", loaded ? tools : null, (cached) => {
    setTools(cached);
    setLoaded(true);
  });

  function apply(data: { tools: Tool[] } | null) {
    if (!data) return;
    cache.markFresh();
    setTools(data.tools ?? []);
    setLoaded(true);
  }

  function load() {
    fetchTools().then(apply);
  }

  useEffect(() => {
    fetchTools().then(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    if (!(await send("/api/tools", "POST", { ...draft, status: "want" }))) return;
    setDraft(EMPTY);
    load();
  }

  async function save(id: string, next: Draft) {
    setEditingId(null);
    setTools((list) => list.map((t) => (t.id === id ? { ...t, ...next, name: next.name.trim() } : t)));
    if (!(await send(`/api/tools/${id}`, "PATCH", next))) load();
  }

  async function changeStatus(id: string, status: ToolStatus) {
    setTools((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    if (!(await send(`/api/tools/${id}`, "PATCH", { status }))) load();
  }

  async function remove(tool: Tool) {
    if (!confirm(`"${tool.name}"을 지울까요?`)) return;
    setTools((list) => list.filter((t) => t.id !== tool.id));
    if (!(await send(`/api/tools/${tool.id}`, "DELETE"))) load();
  }

  const usedKinds = [...new Set(tools.map((t) => t.kind).filter(Boolean))];
  const kinds = [...new Set([...usedKinds, ...DEFAULT_TOOL_KINDS])];
  const activeKind = kindFilter && usedKinds.includes(kindFilter) ? kindFilter : null;
  const visible = activeKind ? tools.filter((t) => t.kind === activeKind) : tools;
  const byStatus = (s: ToolStatus) => visible.filter((t) => t.status === s);
  const dropped = byStatus("dropped");

  function renderList(list: Tool[]) {
    return (
      <ul>
        {list.map((t) => (
          <li key={t.id} className="border-b">
            {editingId === t.id ? (
              <ToolEditor tool={t} kinds={kinds} onSave={(next) => save(t.id, next)} onCancel={() => setEditingId(null)} />
            ) : (
              <ToolItem
                tool={t}
                onStatus={(s) => changeStatus(t.id, s)}
                onEdit={() => setEditingId(t.id)}
                onDelete={() => remove(t)}
              />
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <datalist id={KIND_LIST_ID}>
        {kinds.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      <form onSubmit={add} className="composer space-y-3">
        <label htmlFor="new-tool" className="composer-label">
          써볼 도구 적기
        </label>
        <div className="flex items-center gap-3">
          <input
            id="new-tool"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={100}
            placeholder="예: 플러그인, MCP 서버 이름"
            className="composer-input"
          />
          <button type="submit" aria-label="추가" className="add-btn">
            <AddIcon />
          </button>
        </div>
        <div className="border-t pt-3">
          <ToolFields draft={draft} onChange={setDraft} kinds={kinds} />
        </div>
      </form>

      {usedKinds.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setKindFilter(null)} aria-pressed={!activeKind} className="chip h-7 px-3">
            전체
          </button>
          {usedKinds.map((k) => (
            <button key={k} type="button" onClick={() => setKindFilter(k)} aria-pressed={activeKind === k} className="chip h-7 px-3">
              {k}
            </button>
          ))}
        </div>
      )}

      {!loaded ? (
        <ListSkeleton rows={3} />
      ) : tools.length === 0 ? (
        <p className="empty">써보고 싶은 플러그인이나 도구를 적어두세요.</p>
      ) : (
        <>
          <Section title={TOOL_STATUS_LABEL.want} tone="navy" aside={`${byStatus("want").length}개`}>
            {byStatus("want").length > 0 ? renderList(byStatus("want")) : <p className="empty">다 써봤어요.</p>}
          </Section>
          {byStatus("using").length > 0 && (
            <Section title={TOOL_STATUS_LABEL.using} tone="blue" aside={`${byStatus("using").length}개`}>
              {renderList(byStatus("using"))}
            </Section>
          )}
          {dropped.length > 0 && (
            <details className="group">
              <summary className="section-head cursor-pointer list-none" style={{ borderBottomColor: "var(--rule)" }}>
                <span className="text-pencil">{TOOL_STATUS_LABEL.dropped}</span>
                <span className="aside">{dropped.length}개</span>
              </summary>
              {renderList(dropped)}
            </details>
          )}
        </>
      )}
    </>
  );
}
