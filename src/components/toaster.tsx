"use client";

import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts, type Toast } from "@/lib/toast";

const EMPTY: Toast[] = [];

// 하단 탭바 위에 뜸
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: t.tone === "error" ? "var(--navy)" : "var(--ink)",
            color: "var(--paper)",
          }}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                dismissToast(t.id);
                t.action?.onClick();
              }}
              className="flex-none font-semibold"
              style={{ color: "var(--mint)" }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
