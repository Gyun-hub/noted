"use client";
/* eslint-disable @next/next/no-img-element -- 쇼핑몰 이미지 주소를 그대로 보여줌 */

import { useState } from "react";
import { DeleteButton, EditActions, EditButton } from "@/components/inline-edit";
import { CATEGORIES, CATEGORY_FIELDS, type Category } from "@/lib/closet";
import { useWishlist, type WishlistCandidate, type WishlistInput } from "@/lib/closet-wishlist";
import { showToast } from "@/lib/toast";

type Preview = { images: string[]; title: string; price: string; siteName: string };

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 화면에 보여줄 숫자: 64 / 75.2 (뒤에 붙는 .0은 뺌) */
function num(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[12px] font-medium text-pencil">{children}</span>;
}

/** 상품 페이지 제목에서 " - 사이즈 & 후기 | 무신사" 같은 꼬리표를 덜어냄 */
function tidyTitle(title: string) {
  return title.split(/\s+[-|]\s+/)[0].trim().slice(0, 120);
}

function CandidateCard({
  item,
  onEdit,
  onDelete,
  onCheck,
}: {
  item: WishlistCandidate;
  onEdit: () => void;
  onDelete: () => void;
  onCheck: () => void;
}) {
  const measured = Object.entries(item.measurements);
  return (
    <div className="flex gap-3 py-4">
      <div className="h-24 w-24 flex-none overflow-hidden rounded-lg bg-grid">
        {item.imageUrl &&
          (item.productUrl ? (
            <a href={item.productUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </a>
          ) : (
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 leading-snug">
            <span className="mr-1.5 text-[12px] text-pencil">{item.category}</span>
            <span className="font-semibold">{item.brand}</span>
          </p>
          <EditButton onClick={onEdit} />
          <DeleteButton onClick={onDelete} />
        </div>

        {item.name && <p className="mt-0.5 text-[13px] leading-snug">{item.name}</p>}

        {(item.price || item.recommendedSize) && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {item.price ? <span className="text-[13px] font-semibold">{won(item.price)}</span> : null}
            {item.recommendedSize && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold leading-relaxed"
                style={{ background: "var(--navy-soft)", color: "var(--navy)" }}
              >
                추천 {item.recommendedSize}
              </span>
            )}
          </div>
        )}

        {measured.length > 0 && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-pencil">
            {measured.map(([field, value], i) => (
              <span key={field}>
                {i > 0 && " · "}
                {field} <span className="text-ink">{num(value)}</span>
              </span>
            ))}
          </p>
        )}

        {item.memo && <p className="mt-1 whitespace-pre-line text-[13px]">{item.memo}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.productUrl && (
            <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-btn">
              상품 링크
            </a>
          )}
          <button type="button" onClick={onCheck} className="text-btn">
            새 옷 판정해보기
          </button>
        </div>
      </div>
    </div>
  );
}

/** 구매 후보 추가·수정 폼. 상품 링크를 넣으면 이름·가격·사진을 대신 읽어옴 */
function WishlistForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "저장",
}: {
  initial?: WishlistCandidate;
  onSubmit: (input: WishlistInput) => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [category, setCategory] = useState<Category>(initial?.category ?? "상의");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const [recommendedSize, setRecommendedSize] = useState(initial?.recommendedSize ?? "");
  const [measurements, setMeasurements] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.measurements ?? {}).map(([field, value]) => [field, String(value)])),
  );
  const [productUrl, setProductUrl] = useState(initial?.productUrl ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [previewState, setPreviewState] = useState<"idle" | "busy" | string>("idle");

  const fields = CATEGORY_FIELDS[category];

  function changeCategory(next: Category) {
    if (next === category) return;
    setCategory(next);
    setMeasurements({});
  }

  async function fetchPreview() {
    const target = productUrl.trim();
    if (!target) return;
    setPreviewState("busy");
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(target)}`);
      const data: Preview & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가져오지 못했어요");
      if (data.images[0]) setImageUrl(data.images[0]);
      if (!name.trim() && data.title) setName(tidyTitle(data.title));
      if (!price.trim() && data.price && Number(data.price) > 0) setPrice(String(Math.round(Number(data.price))));
      setPreviewState("idle");
      showToast("상품 정보를 읽었어요. 실측은 직접 넣어 주세요");
    } catch (err) {
      setPreviewState(err instanceof Error ? err.message : "가져오지 못했어요");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim() && !name.trim()) {
      showToast("브랜드나 상품명 중 하나는 넣어 주세요", { tone: "error" });
      return;
    }
    const numbers: Record<string, number> = {};
    for (const field of fields) {
      const value = Number(measurements[field]);
      if (measurements[field]?.trim() && value > 0) numbers[field] = Math.round(value * 10) / 10;
    }
    const parsedPrice = Number(price.replaceAll(",", ""));
    onSubmit({
      category,
      brand: brand.trim(),
      name: name.trim(),
      price: price.trim() && parsedPrice > 0 ? Math.round(parsedPrice) : undefined,
      recommendedSize: recommendedSize.trim(),
      measurements: numbers,
      productUrl: productUrl.trim(),
      imageUrl: imageUrl.trim(),
      memo: memo.trim(),
    });
  }

  const previewError = previewState !== "idle" && previewState !== "busy" ? previewState : null;

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="space-y-5 py-3">
      <div>
        <Label>카테고리</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => changeCategory(c)} aria-pressed={category === c} className="chip h-7 px-3">
              {c}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <Label>상품 링크</Label>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://"
            className="field field-sm min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={fetchPreview}
            disabled={!productUrl.trim() || previewState === "busy"}
            className="chip h-7 flex-none px-3 disabled:opacity-50"
          >
            {previewState === "busy" ? "읽는 중" : "가져오기"}
          </button>
        </div>
        {previewError && <p className="mt-1 text-[12px] text-navy">{previewError}</p>}
      </label>

      <div className="flex gap-4">
        <label className="min-w-0 flex-1">
          <Label>브랜드</Label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={50} placeholder="예: 무신사 스탠다드" className="field field-sm" />
        </label>
        <label className="min-w-0 flex-[2]">
          <Label>상품명</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="예: 헤비웨이트 크루 넥 티셔츠" className="field field-sm" />
        </label>
      </div>

      <div className="flex gap-4">
        <label className="min-w-0 flex-1">
          <Label>가격 (원)</Label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25900"
            className="field field-sm"
          />
        </label>
        <label className="min-w-0 flex-[2]">
          <Label>추천 사이즈 (선택)</Label>
          <input
            value={recommendedSize}
            onChange={(e) => setRecommendedSize(e.target.value)}
            maxLength={80}
            placeholder="예: 2XL (세미오버)"
            className="field field-sm"
          />
        </label>
      </div>

      {fields.length > 0 && (
        <div>
          <Label>실측 (cm) — 판정에 쓰는 값</Label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((field) => (
              <label key={field} className="flex items-baseline gap-2">
                <span className="w-[4.5rem] flex-none text-[13px]">{field}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={measurements[field] ?? ""}
                  onChange={(e) => setMeasurements((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="field field-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <Label>이미지 주소</Label>
        <div className="flex items-center gap-2">
          {imageUrl && <img src={imageUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-none rounded-md bg-grid object-cover" />}
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="링크에서 가져오거나 직접 붙여넣기"
            className="field field-sm min-w-0 flex-1"
          />
        </div>
      </label>

      <label className="block">
        <Label>메모</Label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="예: 20수 헤비웨이트라 비침 없음 / 총장 75cm면 밑단 안 처짐"
          className="field field-sm resize-none"
        />
      </label>

      <div className="flex justify-end">
        <EditActions onCancel={onCancel} saveLabel={submitLabel} />
      </div>
    </form>
  );
}

/** 옷 메뉴 '구매 후보' 탭. 담아둔 후보를 카드로 보여주고, 새 옷 판정으로 넘겨줄 수 있음 */
export function ClosetWishlist({ onCheck }: { onCheck: (candidate: WishlistCandidate) => void }) {
  const { candidates, add, update, remove } = useWishlist();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function create(input: WishlistInput) {
    if (!add(input)) {
      showToast("이 기기에 저장하지 못했어요", { tone: "error" });
      return;
    }
    setAdding(false);
    showToast("구매 후보에 담았어요");
  }

  function save(id: string, input: WishlistInput) {
    if (!update(id, input)) {
      showToast("이 기기에 저장하지 못했어요", { tone: "error" });
      return;
    }
    setEditingId(null);
    showToast("구매 후보를 고쳤어요");
  }

  function drop(item: WishlistCandidate) {
    if (!confirm(`"${[item.brand, item.name].filter(Boolean).join(" ")}" 후보를 지울까요?`)) return;
    if (!remove(item.id)) {
      showToast("이 기기에 저장하지 못했어요", { tone: "error" });
      return;
    }
    showToast("구매 후보에서 지웠어요");
  }

  return (
    <div>
      <p className="text-[13px] text-pencil">
        사고 싶은 옷을 링크·사진·실측과 함께 담아두면, 살 때 내 기준 사이즈로 바로 판정해 볼 수 있어요. 담은 후보는 이 기기에만
        저장돼요.
      </p>

      {adding ? (
        <div className="composer mt-4">
          <p className="composer-label">구매 후보 담기</p>
          <WishlistForm onSubmit={create} onCancel={() => setAdding(false)} submitLabel="담기" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="composer mt-4 flex w-full items-center justify-between text-left"
        >
          <span className="text-pencil">구매 후보 담기</span>
          <span className="add-btn" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}

      {candidates.length > 0 ? (
        <>
          <h2 className="section-head mt-6">
            <span>후보 {candidates.length}개</span>
            <span className="aside">이 기기에 저장돼 있어요</span>
          </h2>
          <ul className="mt-1">
            {candidates.map((item) => (
              <li key={item.id} className="border-b">
                {editingId === item.id ? (
                  <WishlistForm
                    initial={item}
                    onSubmit={(input) => save(item.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <CandidateCard
                    item={item}
                    onEdit={() => {
                      setEditingId(item.id);
                      setAdding(false);
                    }}
                    onDelete={() => drop(item)}
                    onCheck={() => onCheck(item)}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="empty">아직 담아둔 후보가 없어요. 마음에 드는 옷을 링크와 함께 담아두세요.</p>
      )}
    </div>
  );
}
