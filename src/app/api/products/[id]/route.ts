import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStore } from "@/lib/validate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: { done?: boolean; name?: string; store?: string | null } = {};
  if (typeof body?.done === "boolean") update.done = body.done;
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name empty" }, { status: 400 });
    update.name = name;
  }
  if (body && "store" in body) {
    const store = parseStore(body.store);
    if (store === undefined) return NextResponse.json({ error: "store invalid" }, { status: 400 });
    update.store = store;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "done, name or store required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_products").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
