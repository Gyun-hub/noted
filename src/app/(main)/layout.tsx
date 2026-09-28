"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/toaster";

const tabs = [
  {
    href: "/home",
    label: "홈",
    icon: <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z" />,
  },
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

  return (
    <div className="relative min-h-dvh">
      <Link
        href="/settings"
        aria-label="설정"
        aria-current={pathname?.startsWith("/settings") ? "page" : undefined}
        className="icon-btn fixed z-30"
        style={{
          top: "calc(1.25rem + env(safe-area-inset-top))",
          right: "1rem",
          color: pathname?.startsWith("/settings") ? "var(--navy)" : undefined,
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      </Link>

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
