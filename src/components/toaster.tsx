"use client";

import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts, type Toast } from "@/lib/toast";

const EMPTY: Toast[] = [];

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full border bg-surface px-4 py-2.5 text-sm shadow-lg"
          style={t.tone === "error" ? { borderColor: "var(--accent)" } : undefined}
        >
          <span className="flex-1 truncate" style={t.tone === "error" ? { color: "var(--accent)" } : undefined}>
            {t.message}
          </span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                dismissToast(t.id);
                t.action?.onClick();
              }}
              className="flex-none font-mono text-[11px] uppercase tracking-wide text-accent"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
