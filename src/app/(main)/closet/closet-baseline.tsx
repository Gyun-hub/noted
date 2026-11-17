"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_FIELDS, average, type Category, type Clothing } from "@/lib/closet";
import { showToast } from "@/lib/toast";
import type { Baselines } from "@/lib/closet-baseline";

function toInput(values: Record<string, number> | undefined) {
  return Object.fromEntries(Object.entries(values ?? {}).map(([field, value]) => [field, String(value)]));
}

/** 화면에 보여줄 숫자: 62 / 62.5 (뒤에 붙는 .0은 뺌) */
function num(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 카테고리별 '내 기준 사이즈' 직접 입력. 저장하면 '새 옷 판정'에서 내 옷들 평균보다 이 값을 먼저 비교한다.
 * 입력 중인 값은 draft로 들고, 없으면 저장된 값(또는 빈 칸)을 그대로 보여줌.
 */
export function ClosetBaseline({
  clothes,
  baselines,
  onSave,
}: {
  clothes: Clothing[];
  baselines: Baselines;
  onSave: (category: Category, values: Record<string, number>) => boolean;
}) {
  const editable = CATEGORIES.filter((c) => CATEGORY_FIELDS[c].length > 0);
  const [category, setCategory] = useState<Category>("상의");
  // 입력 중엔 "62." 같은 값도 남아야 해서 문자열로 들고 있다가 저장할 때 숫자로
  const [draft, setDraft] = useState<{ category: Category; values: Record<string, string> } | null>(null);
  const values = draft && draft.category === category ? draft.values : toInput(baselines[category]);

  function editValues(next: Record<string, string>) {
    setDraft({ category, values: next });
  }

  const fields = CATEGORY_FIELDS[category];
  const saved = baselines[category] ?? {};
  const savedFields = fields.filter((f) => typeof saved[f] === "number");

  // 옅게 보여줄 내 옷 평균: '적당함' 기록이 있으면 그것만, 없으면 같은 카테고리 전체
  const same = clothes.filter((c) => c.category === category);
  const perfect = same.filter((c) => c.fit_overall === "perfect");
  const sample = perfect.length > 0 ? perfect : same;
  function averageOf(field: string) {
    const nums = sample.map((c) => c.measurements[field]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return nums.length > 0 ? Math.round(average(nums) * 10) / 10 : null;
  }

  function fillAverages() {
    const next = { ...values };
    let filled = 0;
    for (const field of fields) {
      const avg = averageOf(field);
      if (avg === null) continue;
      next[field] = String(avg);
      filled += 1;
    }
    if (filled === 0) {
      showToast("채울 수 있는 실측 기록이 없어요", { tone: "error" });
      return;
    }
    editValues(next);
    showToast("내 옷 평균으로 채웠어요. 고친 뒤 저장하세요");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const picked: Record<string, number> = {};
    for (const field of fields) {
      const n = Number(values[field]);
      if (!values[field]?.trim() || !(n > 0)) continue;
      picked[field] = Math.round(n * 10) / 10;
    }
    if (Object.keys(picked).length === 0) {
      if (savedFields.length === 0) {
        showToast("값을 하나 이상 넣어 주세요", { tone: "error" });
        return;
      }
      // 저장된 기준을 다 비우고 저장하면 지우는 것
      if (!onSave(category, {})) {
        showToast("이 기기에 저장하지 못했어요", { tone: "error" });
        return;
      }
      setDraft(null);
      showToast(`${category} 기준 사이즈를 지웠어요`);
      return;
    }
    if (!onSave(category, picked)) {
      showToast("이 기기에 저장하지 못했어요", { tone: "error" });
      return;
    }
    setDraft(null);
    showToast(`${category} 기준 사이즈를 저장했어요`);
  }

  function clear() {
    if (!confirm(`${category} 기준 사이즈를 지울까요? 새 옷 판정은 다시 내 옷 평균으로 비교해요.`)) return;
    if (!onSave(category, {})) {
      showToast("이 기기에 저장하지 못했어요", { tone: "error" });
      return;
    }
    setDraft(null);
    showToast(`${category} 기준 사이즈를 지웠어요`);
  }

  return (
    <div>
      <p className="text-[13px] text-pencil">
        내 몸에 맞는 실측값을 카테고리별로 적어두면, 새 옷을 볼 때 내 옷 평균보다 이 값을 먼저 비교해요. 비워 둔 항목은
        그대로 평균으로 비교해요.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {editable.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className="chip h-7 px-3">
            {c}
            {baselines[c] && <span className="ml-1 text-[11px] opacity-70">저장됨</span>}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="composer mt-4 space-y-4">
        <p className="composer-label">{category} 기준 사이즈 (cm)</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {fields.map((field) => {
            const avg = averageOf(field);
            return (
              <label key={field} className="flex items-baseline gap-2">
                <span className="w-[4.5rem] flex-none text-[13px]">{field}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={values[field] ?? ""}
                  placeholder={avg === null ? "—" : avg.toFixed(1)}
                  onChange={(e) => editValues({ ...values, [field]: e.target.value })}
                  className="field field-sm"
                />
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[12px] text-pencil">
            옅게 보이는 숫자는 {perfect.length > 0 ? "‘적당함’ 옷" : "같은 카테고리 전체"} 평균이에요
            {sample.length > 0 && ` (${sample.length}벌)`}.
          </span>
          {sample.length > 0 && (
            <button type="button" onClick={fillAverages} className="text-btn">
              평균으로 채우기
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          {savedFields.length > 0 && (
            <button type="button" onClick={clear} className="text-btn">
              기준 지우기
            </button>
          )}
          <button type="submit" className="ml-auto h-9 rounded-full bg-navy px-4 text-[14px] font-medium text-paper">
            저장
          </button>
        </div>
      </form>

      {Object.keys(baselines).length > 0 && (
        <section>
          <h2 className="section-head">
            <span>저장한 기준</span>
            <span className="aside">이 기기에 저장돼 있어요</span>
          </h2>
          <ul className="mt-1">
            {editable
              .filter((c) => baselines[c])
              .map((c) => {
                const entries = Object.entries(baselines[c] ?? {});
                return (
                  <li key={c} className="row items-start">
                    <span className="w-[3.5rem] flex-none pt-0.5 text-[13px] font-semibold">{c}</span>
                    <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-pencil">
                      {entries.map(([field, value], i) => (
                        <span key={field}>
                          {i > 0 && " · "}
                          {field} <span className="text-ink">{num(value)}</span>
                        </span>
                      ))}
                    </span>
                    <button type="button" onClick={() => setCategory(c)} className="flex-none text-btn">
                      고치기
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
