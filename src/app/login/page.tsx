"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("checking");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/today");
      router.refresh();
      return;
    }

    if (res?.status === 429) {
      const data = await res.json().catch(() => null);
      const minutes = Math.max(1, Math.ceil((data?.retryAfter ?? 900) / 60));
      setMessage(`여러 번 틀려서 잠겼어요. ${minutes}분 뒤에 다시 해보세요.`);
    } else if (res?.status === 401) {
      setMessage("PIN이 맞지 않아요.");
    } else {
      setMessage("서버에 연결하지 못했어요. 잠시 뒤에 다시 해보세요.");
    }
    setStatus("error");
    setPin("");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="page-title">noted</h1>
      <p className="mt-2 mb-10 text-sm text-pencil">PIN을 입력하면 열려요</p>

      <form onSubmit={handleSubmit} className="composer">
        <label htmlFor="pin" className="composer-label">
          PIN
        </label>
        <div className="flex items-center gap-3">
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? "pin-error" : undefined}
            className="composer-input text-2xl tracking-[0.4em]"
          />
          <button
            type="submit"
            disabled={status === "checking"}
            className="h-10 flex-none rounded-full bg-navy px-5 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {status === "checking" ? "확인 중" : "열기"}
          </button>
        </div>
      </form>

      {status === "error" && (
        <p id="pin-error" role="alert" className="-mt-6 text-sm font-medium text-navy">
          {message}
        </p>
      )}
    </main>
  );
}
