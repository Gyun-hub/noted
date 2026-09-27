import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStore } from "@/lib/validate";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_products")
    .select("id, name, done, store")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const store = parseStore(body?.store);
  if (store === undefined) return NextResponse.json({ error: "store invalid" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_products").insert({ name, store });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// 완료 항목 일괄 삭제. 실수로 전체 삭제되지 않게 ?done=true 필수
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("done") !== "true") {
    return NextResponse.json({ error: "done=true required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_products").delete().eq("done", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
