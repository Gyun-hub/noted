"use client";
/* eslint-disable @next/next/no-img-element -- 쇼핑몰 이미지 주소를 그대로 보여줌 */

import { useState } from "react";
import { EditActions } from "@/components/inline-edit";
import {
  CATEGORIES,
  CATEGORY_FIELDS,
  FIT_LABEL,
  FIT_LEVELS,
  PART_FIT_FIELDS,
  type Category,
  type Clothing,
  type ClothingInput,
  type Fit,
} from "@/lib/closet";

type Preview = { images: string[]; title: string; price: string; siteName: string };

export const SOURCE_LIST_ID = "closet-sources";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[12px] font-medium text-pencil">{children}</span>;
}

/** 옷 기록 추가·수정 폼 */
export function ClosetForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "저장",
}: {
  initial?: Clothing;
  onSubmit: (input: ClothingInput) => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [category, setCategory] = useState<Category>(initial?.category ?? "상의");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [sizeLabel, setSizeLabel] = useState(initial?.size_label ?? "");
  // 입력 중엔 "48." 같은 값도 남아야 해서 문자열로 들고 있다가 저장할 때 숫자로
  const [measurements, setMeasurements] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.measurements ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [fieldFit, setFieldFit] = useState<Record<string, Fit>>(initial?.field_fit ?? {});
  const [fitOverall, setFitOverall] = useState<Fit>(initial?.fit_overall ?? "perfect");
  const [fitNotes, setFitNotes] = useState(initial?.fit_notes ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? "");
  const [productUrl, setProductUrl] = useState(initial?.product_url ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "busy" | string>("idle");

  const fields = CATEGORY_FIELDS[category];

  function changeCategory(next: Category) {
    if (next === category) return;
    setCategory(next);
    setMeasurements({});
    setFieldFit({});
  }

  function setPartFit(field: string, value: string) {
    setFieldFit((prev) => {
      const copy = { ...prev };
      if (value) copy[field] = value as Fit;
      else delete copy[field];
      return copy;
    });
  }

  async function fetchPreview() {
    const target = productUrl.trim();
    if (!target) return;
    setPreviewState("busy");
    setPreview(null);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가져오지 못했어요");
      setPreview(data);
      if (data.images[0]) setImageUrl(data.images[0]);
      if (!source.trim() && data.siteName) setSource(data.siteName.slice(0, 50));
      setPreviewState("idle");
    } catch (err) {
      setPreviewState(err instanceof Error ? err.message : "가져오지 못했어요");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim()) return;
    const numbers: Record<string, number> = {};
    for (const field of fields) {
      const value = Number(measurements[field]);
      if (measurements[field]?.trim() && value > 0) numbers[field] = Math.round(value * 10) / 10;
    }
    onSubmit({
      category,
      brand: brand.trim(),
      sizeLabel: sizeLabel.trim(),
      measurements: numbers,
      fieldFit: Object.fromEntries(Object.entries(fieldFit).filter(([f]) => fields.includes(f))),
      fitOverall,
      fitNotes: fitNotes.trim(),
      source: source.trim(),
      purchaseDate,
      productUrl: productUrl.trim(),
      imageUrl: imageUrl.trim(),
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

      <div className="flex gap-4">
        <label className="min-w-0 flex-[2]">
          <Label>브랜드</Label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={50} required placeholder="예: 유니클로" className="field field-sm" />
        </label>
        <label className="min-w-0 flex-1">
          <Label>사이즈</Label>
          <input value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} maxLength={50} placeholder="M, 95" className="field field-sm" />
        </label>
      </div>

      {fields.length > 0 && (
        <div>
          <Label>실측 (cm)</Label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((field) => (
              <div key={field}>
                <label className="flex items-baseline gap-2">
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
                {PART_FIT_FIELDS.includes(field) && (
                  <select
                    value={fieldFit[field] ?? ""}
                    onChange={(e) => setPartFit(field, e.target.value)}
                    aria-label={`${field} 핏`}
                    className="mt-1 w-full bg-transparent text-[12px] text-pencil"
                  >
                    <option value="">부위 핏 (선택)</option>
                    {FIT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {FIT_LABEL[level]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>입어보니</Label>
        <div className="flex flex-wrap gap-1.5">
          {FIT_LEVELS.map((level) => (
            <button key={level} type="button" onClick={() => setFitOverall(level)} aria-pressed={fitOverall === level} className="chip h-7 px-3">
              {FIT_LABEL[level]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="min-w-0 flex-1">
          <Label>구매처</Label>
          <input value={source} onChange={(e) => setSource(e.target.value)} list={SOURCE_LIST_ID} maxLength={50} placeholder="예: 무신사" className="field field-sm" />
        </label>
        <label className="min-w-0 flex-1">
          <Label>구매일</Label>
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="field field-sm" />
        </label>
      </div>

      <div>
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
        {preview && (
          <p className="mt-1 truncate text-[12px] text-pencil">
            {[preview.title, preview.price && `${Number(preview.price).toLocaleString("ko-KR")}원`].filter(Boolean).join(" · ") ||
              "상품 정보를 찾지 못했어요"}
          </p>
        )}
        {preview && preview.images.length > 0 && (
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {preview.images.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setImageUrl(src)}
                aria-pressed={imageUrl === src}
                aria-label="이 이미지 쓰기"
                className="h-16 w-16 flex-none overflow-hidden rounded-lg border-2 bg-grid"
                style={{ borderColor: imageUrl === src ? "var(--navy)" : "transparent" }}
              >
                <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="block">
        <Label>이미지 주소</Label>
        <div className="flex items-center gap-2">
          {imageUrl && (
            <img src={imageUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-none rounded-md bg-grid object-cover" />
          )}
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
          value={fitNotes}
          onChange={(e) => setFitNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="예: 어깨는 맞는데 기장이 좀 짧음"
          className="field field-sm resize-none"
        />
      </label>

      <div className="flex justify-end">
        <EditActions onCancel={onCancel} saveLabel={submitLabel} />
      </div>
    </form>
  );
}
