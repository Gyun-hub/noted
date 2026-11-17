"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_FIELDS, judgeFit, type Category, type Clothing, type JudgeResult } from "@/lib/closet";
import type { Baselines } from "@/lib/closet-baseline";

const CHEST = "가슴단면";

const TONE_COLOR: Record<JudgeResult["overall"] | "none", string> = {
  tight: "var(--blue)",
  loose: "var(--navy)",
  ok: "var(--ink)",
  unknown: "var(--pencil)",
  none: "var(--pencil)",
};

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

/**
 * 사려는 옷 실측을 넣으면 내 기준(직접 정한 값 또는 내 옷 평균)과 비교.
 * initial을 넘기면 '구매 후보'에서 고른 옷의 실측이 미리 채워짐 (page에서 key로 다시 그림)
 */
export function ClosetCheck({
  clothes,
  baselines,
  onEditBaseline,
  initial,
}: {
  clothes: Clothing[];
  baselines: Baselines;
  onEditBaseline: () => void;
  initial?: { category: Category; values: Record<string, number> };
}) {
  const [category, setCategory] = useState<Category>(initial?.category ?? "상의");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.values ?? {}).map(([field, value]) => [field, String(value)])),
  );
  // 쇼핑몰마다 가슴을 단면/둘레로 다르게 적어서, 둘레면 반으로 나눠 비교
  const [chestRound, setChestRound] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);

  const fields = CATEGORY_FIELDS[category];
  const sameCount = clothes.filter((c) => c.category === category).length;
  const own = baselines[category];
  const ownFields = own ? fields.filter((f) => typeof own[f] === "number") : [];

  function changeCategory(next: Category) {
    setCategory(next);
    setValues({});
    setChestRound(false);
    setResult(null);
  }

  function check(e: React.FormEvent) {
    e.preventDefault();
    const target: Record<string, number> = {};
    for (const field of fields) {
      const value = Number(values[field]);
      if (!values[field]?.trim() || !(value > 0)) continue;
      target[field] = field === CHEST && chestRound ? value / 2 : value;
    }
    if (Object.keys(target).length === 0) return;
    setResult(judgeFit(category, target, clothes, baselines[category]));
  }

  return (
    <div>
      <p className="text-[13px] text-pencil">
        사려는 옷의 실측을 넣으면 내 기준과 비교해요. 1cm 차이까지는 적당으로 봐요.
      </p>
      {initial && <p className="mt-1 text-[12px] text-navy">구매 후보에서 불러온 실측이에요. 고친 뒤 판정하기를 눌러 주세요.</p>}

      <form onSubmit={check} className="composer mt-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.filter((c) => CATEGORY_FIELDS[c].length > 0).map((c) => (
            <button key={c} type="button" onClick={() => changeCategory(c)} aria-pressed={category === c} className="chip h-7 px-3">
              {c}
            </button>
          ))}
        </div>

        {ownFields.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-navy">
            <span>
              {category} — 직접 정한 기준 {ownFields.length}개 항목과 비교
            </span>
            <button type="button" onClick={onEditBaseline} className="text-btn">
              기준 고치기
            </button>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-pencil">
            <span>{category} 기록 {sameCount}개와 비교</span>
            <button type="button" onClick={onEditBaseline} className="text-btn">
              기준 사이즈 정하기
            </button>
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {fields.map((field) => (
            <label key={field} className="flex items-baseline gap-2">
              <span className="w-[4.5rem] flex-none text-[13px]">{field === CHEST && chestRound ? "가슴둘레" : field}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={values[field] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                className="field field-sm"
              />
            </label>
          ))}
        </div>

        {fields.includes(CHEST) && (
          <button type="button" onClick={() => setChestRound((v) => !v)} aria-pressed={chestRound} className="chip h-7 px-3">
            가슴을 둘레로 입력
          </button>
        )}

        <div className="flex justify-end border-t pt-3">
          <button type="submit" className="h-9 rounded-full bg-navy px-4 text-[14px] font-medium text-paper">
            판정하기
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6" aria-live="polite">
          <p className="text-[20px] font-bold" style={{ color: TONE_COLOR[result.overall] }}>
            {result.overallLabel}
          </p>
          {result.usedOwnBaseline && (
            <p className="mt-1 text-[12px] text-pencil">
              직접 설정한 기준 사이즈와 비교했어요.
              {result.fields.some((f) => f.source === "average") && " 비워 둔 항목은 내 옷 평균으로 비교했어요."}
            </p>
          )}
          {result.usedFallback && result.overall !== "unknown" && (
            <p className="mt-1 text-[12px] text-pencil">&lsquo;적당함&rsquo; 기록이 없어서 같은 카테고리 전체 평균과 비교했어요.</p>
          )}
          <ul className="mt-3">
            {result.fields.map((f) => (
              <li key={f.field} className="row text-[14px]">
                <span className="w-[4.5rem] flex-none">{f.field}</span>
                <span className="min-w-0 flex-1 text-[13px] text-pencil">
                  {f.baseline === null || f.diff === null
                    ? `${f.target}`
                    : `${f.target} / ${f.source === "mine" ? "내 기준" : "내 옷 평균"} ${f.baseline.toFixed(1)} (${signed(f.diff)})`}
                </span>
                <span className="flex-none font-semibold" style={{ color: TONE_COLOR[f.tone] }}>
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
