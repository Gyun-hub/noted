"use client";

import { useState } from "react";

export function EditButton({ onClick, label = "수정" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="icon-btn">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function DeleteButton({ onClick, label = "삭제" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="icon-btn" data-tone="navy">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function EditActions({ onCancel, saveLabel = "저장" }: { onCancel: () => void; saveLabel?: string }) {
  return (
    <div className="flex flex-none items-center gap-1">
      <button type="submit" className="h-8 rounded-full bg-navy px-3 text-[13px] font-medium text-paper">
        {saveLabel}
      </button>
      <button type="button" onClick={onCancel} className="h-8 px-2 text-[13px] text-pencil hover:text-ink">
        취소
      </button>
    </div>
  );
}

/**
 * 텍스트 한 줄(또는 multiline) 인라인 수정 폼.
 * Enter 저장(multiline은 Ctrl/Cmd+Enter), Esc 취소. 값이 비었거나 안 바뀌면 저장 없이 닫힘.
 */
export function InlineEdit({
  value,
  onSave,
  onCancel,
  multiline = false,
  className = "",
}: {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
  multiline?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const next = draft.trim();
    if (!next || next === value) return onCancel();
    onSave(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
    if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
  }

  return (
    <form onSubmit={submit} className={`flex items-end gap-2 ${className}`}>
      {multiline ? (
        <textarea
          autoFocus
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="field resize-none"
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="field"
        />
      )}
      <EditActions onCancel={onCancel} />
    </form>
  );
}
