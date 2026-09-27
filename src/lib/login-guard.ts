import { createAdminClient } from "@/lib/supabase/admin";

// IP별 5회, 전체 합산 20회(IP 바꿔가며 시도하는 경우 대비) 실패 시 15분 잠금.
// 실패 기록은 마지막 실패 후 15분 지나면 초기화.
const LOCK_MS = 15 * 60 * 1000;
export const GLOBAL_KEY = "*";
export const LIMITS: Record<string, number> = { ip: 5, [GLOBAL_KEY]: 20 };

type Attempt = { key: string; fail_count: number; locked_until: string | null; updated_at: string };

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

async function getAttempts(keys: string[]) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("note_login_attempts")
    .select("key, fail_count, locked_until, updated_at")
    .in("key", keys);
  if (error) throw new Error(error.message);
  return (data ?? []) as Attempt[];
}

/** 잠겨 있으면 풀리는 시각(ms), 아니면 null */
export async function lockedUntil(keys: string[]): Promise<number | null> {
  const now = Date.now();
  const until = (await getAttempts(keys))
    .map((a) => (a.locked_until ? Date.parse(a.locked_until) : 0))
    .filter((t) => t > now);
  return until.length ? Math.max(...until) : null;
}

export async function recordFailure(entries: { key: string; limit: number }[]) {
  const now = Date.now();
  const existing = new Map((await getAttempts(entries.map((e) => e.key))).map((a) => [a.key, a]));

  const rows = entries.map(({ key, limit }) => {
    const prev = existing.get(key);
    const stale = !prev || now - Date.parse(prev.updated_at) > LOCK_MS;
    const count = (stale ? 0 : prev.fail_count) + 1;
    const lock = count >= limit;
    return {
      key,
      fail_count: lock ? 0 : count,
      locked_until: lock ? new Date(now + LOCK_MS).toISOString() : (prev?.locked_until ?? null),
      updated_at: new Date(now).toISOString(),
    };
  });

  const supabase = createAdminClient();
  const { error } = await supabase.from("note_login_attempts").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function clearFailures(key: string) {
  const supabase = createAdminClient();
  await supabase.from("note_login_attempts").delete().eq("key", key);
}
