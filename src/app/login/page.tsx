"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("checking");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.replace("/today");
      router.refresh();
    } else {
      setStatus("error");
      setPin("");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-surface p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          daily ledger
        </p>
        <h1 className="mt-1 mb-6 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-accent" />
          noted
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="ledger-input text-center tracking-[0.5em]"
          />
          <button
            type="submit"
            disabled={status === "checking"}
            className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {status === "checking" ? "확인 중..." : "입장"}
          </button>
          {status === "error" && (
            <p className="text-sm text-center" style={{ color: "var(--accent)" }}>
              PIN 틀림. 다시 시도.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
