import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_COLUMNS } from "@/lib/tools";
import { parseTool } from "@/lib/validate";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("note_tools").select(TOOL_COLUMNS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tools: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = parseTool(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_tools").insert(parsed.row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
