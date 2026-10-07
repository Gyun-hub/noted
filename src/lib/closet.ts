// 옷 기록 (fit-log에서 옮겨옴). 산 옷의 실측과 착용 핏을 남기고, 새 옷 실측을 내 기록과 비교해 판정

export const CATEGORIES = ["상의", "하의", "아우터", "원피스", "니트", "셔츠", "신발", "액세서리"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 카테고리별 실측 항목 (cm) */
export const CATEGORY_FIELDS: Record<Category, string[]> = {
  상의: ["어깨너비", "가슴단면", "총장", "소매길이"],
  하의: ["허리단면", "엉덩이단면", "허벅지단면", "밑위", "총장"],
  아우터: ["어깨너비", "가슴단면", "총장", "소매길이"],
  원피스: ["어깨너비", "가슴단면", "허리단면", "총장"],
  니트: ["어깨너비", "가슴단면", "총장", "소매길이"],
  셔츠: ["어깨너비", "가슴단면", "총장", "소매길이"],
  신발: ["발길이", "발볼"],
  액세서리: [],
};

/** 부위별 핏도 따로 남길 수 있는 항목 */
export const PART_FIT_FIELDS = ["어깨너비", "가슴단면", "총장"];

export const FIT_LEVELS = ["very_tight", "tight", "perfect", "loose", "very_loose"] as const;
export type Fit = (typeof FIT_LEVELS)[number];

export const FIT_LABEL: Record<Fit, string> = {
  very_tight: "많이 타이트함",
  tight: "타이트함",
  perfect: "적당함",
  loose: "넉넉함",
  very_loose: "많이 넉넉함",
};

export type Clothing = {
  id: string;
  category: Category;
  brand: string;
  size_label: string;
  measurements: Record<string, number>;
  field_fit: Record<string, Fit>;
  fit_overall: Fit;
  fit_notes: string;
  source: string;
  purchase_date: string | null;
  product_url: string;
  image_url: string;
  created_at: string;
};

export const CLOTHING_COLUMNS =
  "id, category, brand, size_label, measurements, field_fit, fit_overall, fit_notes, source, purchase_date, product_url, image_url, created_at";

/** 화면 입력 → API 본문 (POST/PATCH 공통) */
export type ClothingInput = {
  category: Category;
  brand: string;
  sizeLabel: string;
  measurements: Record<string, number>;
  fieldFit: Record<string, Fit>;
  fitOverall: Fit;
  fitNotes: string;
  source: string;
  purchaseDate: string;
  productUrl: string;
  imageUrl: string;
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isFit(value: unknown): value is Fit {
  return typeof value === "string" && (FIT_LEVELS as readonly string[]).includes(value);
}

// ---------- 판정 ----------

/** 이 차이(cm)까지는 적당으로 봄 */
const TOLERANCE_CM = 1;

export type FieldResult = {
  field: string;
  target: number;
  baseline: number | null;
  diff: number | null;
  sampleSize: number;
  tone: "tight" | "ok" | "loose" | "none";
  label: string;
};

export type JudgeResult = {
  overall: "tight" | "ok" | "loose" | "unknown";
  overallLabel: string;
  fields: FieldResult[];
  /** '적당함' 기록이 없어 같은 카테고리 전체 평균과 비교했는지 */
  usedFallback: boolean;
};

function isLengthField(field: string) {
  return field.includes("길이") || field.includes("총장") || field.includes("밑위");
}

export function average(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * 같은 카테고리에서 '적당함'이었던 옷들의 항목별 평균과 비교.
 * 길이 항목은 짧음/김, 나머지는 타이트함/넉넉함. 종합은 어느 쪽 판정이 더 많은지로.
 */
export function judgeFit(category: Category, target: Record<string, number>, records: Clothing[]): JudgeResult {
  const sameCategory = records.filter((r) => r.category === category);
  let baseline = sameCategory.filter((r) => r.fit_overall === "perfect");
  const usedFallback = baseline.length === 0;
  if (usedFallback) baseline = sameCategory;

  const fields: FieldResult[] = Object.entries(target).map(([field, value]) => {
    const samples = baseline.map((r) => r.measurements[field]).filter((v) => typeof v === "number" && Number.isFinite(v));
    if (samples.length === 0) {
      return { field, target: value, baseline: null, diff: null, sampleSize: 0, tone: "none", label: "비교할 기록 없음" };
    }
    const base = average(samples);
    const diff = value - base;
    const length = isLengthField(field);
    if (diff < -TOLERANCE_CM) {
      return { field, target: value, baseline: base, diff, sampleSize: samples.length, tone: "tight", label: length ? "짧음" : "타이트함" };
    }
    if (diff > TOLERANCE_CM) {
      return { field, target: value, baseline: base, diff, sampleSize: samples.length, tone: "loose", label: length ? "김" : "넉넉함" };
    }
    return { field, target: value, baseline: base, diff, sampleSize: samples.length, tone: "ok", label: "적당" };
  });

  const comparable = fields.filter((f) => f.tone !== "none");
  const tight = comparable.filter((f) => f.tone === "tight").length;
  const loose = comparable.filter((f) => f.tone === "loose").length;

  if (comparable.length === 0) return { overall: "unknown", overallLabel: "판정할 기록이 부족해요", fields, usedFallback };
  if (tight === 0 && loose === 0) return { overall: "ok", overallLabel: "적당할 것 같아요", fields, usedFallback };
  if (tight > loose) return { overall: "tight", overallLabel: "작을 가능성이 높아요", fields, usedFallback };
  if (loose > tight) return { overall: "loose", overallLabel: "클 가능성이 높아요", fields, usedFallback };
  return { overall: "ok", overallLabel: "적당해 보이지만 항목마다 달라요", fields, usedFallback };
}
