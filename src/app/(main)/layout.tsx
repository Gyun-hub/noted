"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/today", label: "today" },
  { href: "/calendar", label: "calendar" },
  { href: "/product", label: "product" },
  { href: "/idea", label: "idea" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    if (!confirm("로그아웃할까요?")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-dvh">
      <main className="pb-10">{children}</main>

      <button
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border bg-surface"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="메뉴 배경 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-black/10"
          />
          <nav className="fixed right-4 top-16 z-30 w-40 overflow-hidden rounded-xl border bg-surface p-1">
            {links.map(({ href, label }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-wide"
                  style={{ color: active ? "var(--accent)" : "var(--text)" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: active ? "var(--accent)" : "var(--border-strong)" }}
                  />
                  {label}
                </Link>
              );
            })}
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted hover:text-accent"
            >
              <span className="h-1.5 w-1.5 rounded-full" />
              logout
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
