"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "@/components/toaster";
import { send } from "@/lib/api";

const tabs = [
  {
    href: "/today",
    label: "오늘",
    icon: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  },
  {
    href: "/calendar",
    label: "달력",
    icon: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      </>
    ),
  },
  {
    href: "/product",
    label: "장보기",
    icon: <path d="M4 5h2l2 10h10l2-7H7.2M10 19.5h.01M17 19.5h.01" />,
  },
  {
    href: "/idea",
    label: "아이디어",
    icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />,
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function lock() {
    if (!confirm("잠글까요? 다시 열려면 PIN이 필요합니다.")) return;
    if (!(await send("/api/auth/logout", "POST"))) return;
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-dvh">
      <button
        type="button"
        onClick={lock}
        aria-label="잠그기"
        className="icon-btn fixed z-30"
        style={{ top: "calc(1.25rem + env(safe-area-inset-top))", right: "1rem" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      <main
        className="mx-auto max-w-md px-5"
        style={{
          paddingTop: "calc(2.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>

      <Toaster />

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-sheet"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md">
          {tabs.map(({ href, label, icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium"
                  style={{ color: active ? "var(--navy)" : "var(--pencil)" }}
                >
                  {active && (
                    <span
                      className="absolute top-0 h-[3px] w-8 rounded-b-full"
                      style={{ background: "var(--mint)" }}
                    />
                  )}
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 2.1 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {icon}
                  </svg>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
