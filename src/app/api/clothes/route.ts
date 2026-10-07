import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLOTHING_COLUMNS } from "@/lib/closet";
import { parseClothing } from "@/lib/validate";

// 최근 산 것 먼저 (구매일 없으면 기록한 순)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_clothes")
    .select(CLOTHING_COLUMNS)
    .order("purchase_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clothes: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = parseClothing(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_clothes").insert(parsed.row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
