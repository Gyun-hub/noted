"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_FIELDS, FIT_LABEL, FIT_LEVELS, average, type Category, type Clothing } from "@/lib/closet";

/** 핏 단계별 실측 평균. 화면이 좁아서 표 대신 항목마다 줄로 */
export function ClosetStats({ clothes }: { clothes: Clothing[] }) {
  const counts = clothes.reduce<Partial<Record<Category, number>>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + 1;
    return acc;
  }, {});
  const withData = CATEGORIES.filter((c) => counts[c] && CATEGORY_FIELDS[c].length > 0);
  const [picked, setPicked] = useState<Category | null>(null);
  const category = picked && withData.includes(picked) ? picked : withData[0];

  if (!category) return <p className="empty">실측을 남긴 기록이 아직 없어요.</p>;

  const same = clothes.filter((c) => c.category === category);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {withData.map((c) => (
          <button key={c} type="button" onClick={() => setPicked(c)} aria-pressed={category === c} className="chip h-7 px-3">
            {c} {counts[c]}
          </button>
        ))}
      </div>

      <ul className="mt-4">
        {CATEGORY_FIELDS[category].map((field) => {
          const levels = FIT_LEVELS.map((level) => {
            const samples = same
              .filter((c) => c.fit_overall === level)
              .map((c) => c.measurements[field])
              .filter((v) => typeof v === "number");
            return { level, count: samples.length, avg: samples.length ? average(samples) : null };
          }).filter((l) => l.avg !== null);
          return (
            <li key={field} className="border-b py-3">
              <p className="text-[14px] font-semibold">{field}</p>
              {levels.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {levels.map((l) => (
                    <span key={l.level} style={{ color: l.level === "perfect" ? "var(--navy)" : "var(--pencil)" }}>
                      {FIT_LABEL[l.level]} <b className="font-semibold">{l.avg!.toFixed(1)}</b>
                      <span className="text-[11px]"> ({l.count})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[13px] text-pencil">기록 없음</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
