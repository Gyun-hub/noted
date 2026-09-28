import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const ALLOWED_OFFSETS = [0, 1, 3, 7] as const;

export type NotifyPayload = { title: string; body: string; url?: string; tag?: string };

function vapidKeys(): VapidKeys {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new Error("VAPID env not set");
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

/** 한국 시간 기준 오늘 날짜 "YYYY-MM-DD"와 현재 시각 "HH:MM" */
export function kstNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * 등록된 모든 기기로 발송. 만료된 구독(404/410)은 지움.
 * 한 대라도 성공하면 sent > 0.
 */
export async function sendToAll(payload: NotifyPayload) {
  const supabase = createAdminClient();
  const { data: subs, error } = await supabase.from("note_push_subscriptions").select("endpoint, p256dh, auth");
  if (error) throw new Error(error.message);

  const vapid = vapidKeys();
  let sent = 0;
  const expired: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      const subscription: PushSubscription = {
        endpoint: s.endpoint,
        expirationTime: null,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        const request = await buildPushPayload(
          { data: payload, options: { ttl: 60 * 60 * 12, urgency: "normal" } },
          subscription,
          vapid,
        );
        const res = await fetch(s.endpoint, request);
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 410) expired.push(s.endpoint);
      } catch {
        // 한 기기 실패가 나머지 발송을 막지 않게
      }
    }),
  );

  if (expired.length) await supabase.from("note_push_subscriptions").delete().in("endpoint", expired);
  return { devices: subs?.length ?? 0, sent, expired: expired.length };
}
