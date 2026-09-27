"use client";

import { useState } from "react";

const iconButtonClass =
  "grid h-6 w-6 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent";

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="수정" className={iconButtonClass}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="삭제" className={iconButtonClass}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function EditActions({ onCancel }: { onCancel: () => void }) {
  return (
    <>
      <button type="submit" aria-label="저장" className={iconButtonClass}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" onClick={onCancel} aria-label="취소" className={iconButtonClass}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </>
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
    <form onSubmit={submit} className={`flex items-end gap-1 ${className}`}>
      {multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="ledger-input resize-none"
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="ledger-input"
        />
      )}
      <EditActions onCancel={onCancel} />
    </form>
  );
}
