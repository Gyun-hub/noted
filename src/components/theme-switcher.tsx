"use client";

import { useEffect, useState } from "react";

// 디자인 3종 미리보기용. 하나 정해지면 이 컴포넌트 + globals.css의 data-theme 블록 지울 것.
const THEMES = [
  { id: "paper", label: "A" },
  { id: "terminal", label: "B" },
  { id: "pastel", label: "C" },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("paper");

  useEffect(() => {
    const saved = localStorage.getItem("preview-theme");
    if (saved && saved !== "paper") {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function apply(id: string) {
    setTheme(id);
    localStorage.setItem("preview-theme", id);
    if (id === "paper") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = id;
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex gap-1 rounded-full border bg-surface p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => apply(t.id)}
          className="grid h-7 w-7 place-items-center rounded-full font-mono text-[11px]"
          style={{
            background: theme === t.id ? "var(--accent)" : "transparent",
            color: theme === t.id ? "#fff" : "var(--text-muted)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
