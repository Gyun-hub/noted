"use client";
/* eslint-disable @next/next/no-img-element -- 쇼핑몰 이미지 주소를 그대로 보여줌 */

import { useEffect, useState } from "react";
import { DeleteButton, EditButton } from "@/components/inline-edit";
import { PageHeader } from "@/components/page";
import { ListSkeleton } from "@/components/skeleton";
import { getJson, send } from "@/lib/api";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { FIT_LABEL, type Clothing, type ClothingInput, type Fit } from "@/lib/closet";
import { useLocalCache } from "@/lib/local-cache";
import { ClosetCheck } from "./closet-check";
import { ClosetForm, SOURCE_LIST_ID } from "./closet-form";
import { ClosetStats } from "./closet-stats";

type View = "list" | "check" | "stats";

const VIEWS: [View, string][] = [
  ["list", "내 옷"],
  ["check", "새 옷 판정"],
  ["stats", "사이즈 통계"],
];

const FIT_STYLE: Record<Fit, { background: string; color: string }> = {
  very_tight: { background: "var(--blue-soft)", color: "var(--blue)" },
  tight: { background: "var(--blue-soft)", color: "var(--blue)" },
  perfect: { background: "var(--mint-soft)", color: "var(--ink)" },
  loose: { background: "var(--navy-soft)", color: "var(--navy)" },
  very_loose: { background: "var(--navy-soft)", color: "var(--navy)" },
};

function FitBadge({ fit }: { fit: Fit }) {
  return (
    <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold" style={FIT_STYLE[fit]}>
      {FIT_LABEL[fit]}
    </span>
  );
}

function ClothingCard({ item, onEdit, onDelete }: { item: Clothing; onEdit: () => void; onDelete: () => void }) {
  const measured = Object.entries(item.measurements);
  return (
    <div className="flex gap-3 py-3">
      <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-grid">
        {item.image_url && (
          <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 leading-snug">
            <span className="mr-1.5 text-[12px] text-pencil">{item.category}</span>
            <span className="font-semibold">{item.brand}</span>
            {item.size_label && <span className="ml-1.5 text-[13px] text-pencil">{item.size_label}</span>}
          </p>
          <EditButton onClick={onEdit} />
          <DeleteButton onClick={onDelete} />
        </div>
        <div className="mt-0.5">
          <FitBadge fit={item.fit_overall} />
        </div>
        {measured.length > 0 && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-pencil">
            {measured.map(([field, value], i) => (
              <span key={field}>
                {i > 0 && " · "}
                {field} <span className="text-ink">{value}</span>
                {item.field_fit[field] && ` (${FIT_LABEL[item.field_fit[field]]})`}
              </span>
            ))}
          </p>
        )}
        {item.fit_notes && <p className="mt-1 whitespace-pre-line text-[13px]">{item.fit_notes}</p>}
        {(item.source || item.purchase_date || item.product_url) && (
          <p className="mt-1 text-[12px] text-pencil">
            {[item.source, item.purchase_date?.replaceAll("-", ".")].filter(Boolean).join(" · ")}
            {item.product_url && (
              <a href={item.product_url} target="_blank" rel="noreferrer" className="text-btn ml-2">
                상품 링크
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function fetchClothes() {
  return getJson<{ clothes: Clothing[] }>("/api/clothes");
}

export default function ClosetPage() {
  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [view, setView] = useState<View>("list");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  // 구매일 기간. 하나라도 정하면 구매일 없는 기록은 빠짐
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // 처음엔 이 기기에 저장해 둔 목록을 먼저 보여주고, 받아오면 최신으로
  const [loaded, setLoaded] = useState(false);
  const cache = useLocalCache<Clothing[]>(CACHE_KEYS.clothes, "", loaded ? clothes : null, (cached) => {
    setClothes(cached);
    setLoaded(true);
  });

  function apply(data: { clothes: Clothing[] } | null) {
    if (!data) return;
    cache.markFresh();
    setClothes(data.clothes ?? []);
    setLoaded(true);
  }

  function load() {
    fetchClothes().then(apply);
  }

  useEffect(() => {
    fetchClothes().then(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(input: ClothingInput) {
    if (!(await send("/api/clothes", "POST", input))) return;
    setAdding(false);
    load();
  }

  async function save(id: string, input: ClothingInput) {
    if (!(await send(`/api/clothes/${id}`, "PATCH", input))) return;
    setEditingId(null);
    load();
  }

  async function remove(item: Clothing) {
    if (!confirm(`"${item.brand}" 기록을 지울까요?`)) return;
    setClothes((list) => list.filter((c) => c.id !== item.id));
    if (!(await send(`/api/clothes/${item.id}`, "DELETE"))) load();
  }

  const categories = [...new Set(clothes.map((c) => c.category))];
  const activeFilter = filter && categories.includes(filter as Clothing["category"]) ? filter : null;
  const visible = clothes.filter((c) => {
    if (activeFilter && c.category !== activeFilter) return false;
    if (dateFrom && (!c.purchase_date || c.purchase_date < dateFrom)) return false;
    if (dateTo && (!c.purchase_date || c.purchase_date > dateTo)) return false;
    return true;
  });
  const periodSet = !!(dateFrom || dateTo);
  const sources = [...new Set(clothes.map((c) => c.source).filter(Boolean))];

  return (
    <>
      <PageHeader title="옷" sub={!loaded ? " " : clothes.length > 0 ? `기록 ${clothes.length}벌` : "산 옷의 실측과 핏을 남겨두세요"} />

      <datalist id={SOURCE_LIST_ID}>
        {sources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="mb-6 flex gap-1 rounded-full bg-grid p-1" role="tablist">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className="h-8 flex-1 rounded-full text-[13px] font-medium transition-colors"
            style={view === value ? { background: "var(--sheet)", color: "var(--navy)" } : { color: "var(--pencil)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "check" && (loaded ? <ClosetCheck clothes={clothes} /> : <ListSkeleton rows={3} />)}
      {view === "stats" && (loaded ? <ClosetStats clothes={clothes} /> : <ListSkeleton rows={3} />)}

      {view === "list" && (
        <>
          {adding ? (
            <div className="composer">
              <p className="composer-label">옷 기록 추가</p>
              <ClosetForm onSubmit={add} onCancel={() => setAdding(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
              className="composer flex w-full items-center justify-between text-left"
            >
              <span className="text-pencil">산 옷 기록하기</span>
              <span className="add-btn" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          )}

          {clothes.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {categories.length > 1 && (
                <>
                  <button type="button" onClick={() => setFilter(null)} aria-pressed={!activeFilter} className="chip h-7 px-3">
                    전체
                  </button>
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={activeFilter === c} className="chip h-7 px-3">
                      {c}
                    </button>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={() => setPeriodOpen((v) => !v)}
                aria-pressed={periodOpen || periodSet}
                aria-expanded={periodOpen}
                data-tone="blue"
                className="chip ml-auto h-7 px-3"
              >
                구매일 {periodSet ? "기간 적용 중" : "기간"}
              </button>
            </div>
          )}

          {periodOpen && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-soft p-3">
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="구매일 시작"
                className="field field-sm min-w-0 flex-1"
              />
              <span className="text-[13px] text-pencil">~</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="구매일 끝"
                className="field field-sm min-w-0 flex-1"
              />
              {periodSet && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-btn flex-none"
                >
                  초기화
                </button>
              )}
            </div>
          )}

          {visible.length > 0 ? (
            <ul className="mt-4">
              {visible.map((item) => (
                <li key={item.id} className="border-b">
                  {editingId === item.id ? (
                    <ClosetForm
                      initial={item}
                      onSubmit={(input) => save(item.id, input)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <ClothingCard
                      item={item}
                      onEdit={() => {
                        setEditingId(item.id);
                        setAdding(false);
                      }}
                      onDelete={() => remove(item)}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : loaded ? (
            <p className="empty">{clothes.length > 0 ? "조건에 맞는 기록이 없어요." : "아직 기록한 옷이 없어요."}</p>
          ) : (
            <ListSkeleton />
          )}
        </>
      )}
    </>
  );
}
