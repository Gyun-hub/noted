import { CATEGORY_FIELDS, PART_FIT_FIELDS, isCategory, isFit, type Fit } from "@/lib/closet";
import { isToolStatus } from "@/lib/tools";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 반복 요일 파싱. 0(일)~6(토) 정수 배열.
 * null/빈 배열/7일 전부 = 매일(null). 형식 틀리면 undefined.
 */
export function parseWeekdays(value: unknown): number[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value)) return undefined;
  if (!value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return undefined;
  const days = [...new Set(value as number[])].sort();
  return days.length === 0 || days.length === 7 ? null : days;
}

/** 장보기 구매처. 빈 값 = null(미정), 50자 제한. 형식 틀리면 undefined */
export function parseStore(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const store = value.trim();
  if (store.length > 50) return undefined;
  return store || null;
}

const MAX_TEXT = 50;
const MAX_NOTES = 1000;
const MAX_URL = 2000;

function text(value: unknown, max: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > max ? undefined : trimmed;
}

/** 빈 값 = "". http(s) 주소만 */
function httpUrl(value: unknown) {
  const raw = text(value, MAX_URL);
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
}

/** 옷 기록 본문 → note_clothes 행. 실측·부위 핏은 그 카테고리 항목만 받음 */
export function parseClothing(body: unknown): { row: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "body required" };
  const b = body as Record<string, unknown>;

  if (!isCategory(b.category)) return { error: "category invalid" };
  const fields = CATEGORY_FIELDS[b.category];

  const brand = text(b.brand, MAX_TEXT);
  if (!brand) return { error: "brand required" };
  const sizeLabel = text(b.sizeLabel, MAX_TEXT);
  const fitNotes = text(b.fitNotes, MAX_NOTES);
  const source = text(b.source, MAX_TEXT);
  const productUrl = httpUrl(b.productUrl);
  const imageUrl = httpUrl(b.imageUrl);
  if (sizeLabel === undefined || fitNotes === undefined || source === undefined) return { error: "text invalid" };
  if (productUrl === undefined || imageUrl === undefined) return { error: "url invalid" };
  if (!isFit(b.fitOverall)) return { error: "fitOverall invalid" };

  const purchaseDate = b.purchaseDate === "" || b.purchaseDate == null ? null : b.purchaseDate;
  if (purchaseDate !== null && (typeof purchaseDate !== "string" || !DATE_RE.test(purchaseDate))) {
    return { error: "purchaseDate invalid" };
  }

  const measurements: Record<string, number> = {};
  if (b.measurements != null) {
    if (typeof b.measurements !== "object") return { error: "measurements invalid" };
    for (const [field, value] of Object.entries(b.measurements)) {
      if (!fields.includes(field) || typeof value !== "number" || !(value > 0 && value < 1000)) {
        return { error: "measurements invalid" };
      }
      measurements[field] = value;
    }
  }

  const fieldFit: Record<string, Fit> = {};
  if (b.fieldFit != null) {
    if (typeof b.fieldFit !== "object") return { error: "fieldFit invalid" };
    for (const [field, value] of Object.entries(b.fieldFit)) {
      if (!fields.includes(field) || !PART_FIT_FIELDS.includes(field) || !isFit(value)) {
        return { error: "fieldFit invalid" };
      }
      fieldFit[field] = value;
    }
  }

  return {
    row: {
      category: b.category,
      brand,
      size_label: sizeLabel,
      measurements,
      field_fit: fieldFit,
      fit_overall: b.fitOverall,
      fit_notes: fitNotes,
      source,
      purchase_date: purchaseDate,
      product_url: productUrl,
      image_url: imageUrl,
    },
  };
}

/**
 * 도구 본문 → note_tools 행. partial이면 들어온 값만 (상태만 바꿀 때)
 */
export function parseTool(body: unknown, partial = false): { row: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "body required" };
  const b = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  if (!partial || "name" in b) {
    const name = text(b.name, 100);
    if (!name) return { error: "name required" };
    row.name = name;
  }
  if (!partial || "url" in b) {
    const url = httpUrl(b.url);
    if (url === undefined) return { error: "url invalid" };
    row.url = url;
  }
  if (!partial || "kind" in b) {
    const kind = text(b.kind, 30);
    if (kind === undefined) return { error: "kind invalid" };
    row.kind = kind;
  }
  if (!partial || "note" in b) {
    const note = text(b.note, MAX_NOTES);
    if (note === undefined) return { error: "note invalid" };
    row.note = note;
  }
  if (!partial || "status" in b) {
    const status = b.status ?? "want";
    if (!isToolStatus(status)) return { error: "status invalid" };
    row.status = status;
  }
  if (Object.keys(row).length === 0) return { error: "nothing to update" };
  return { row };
}
