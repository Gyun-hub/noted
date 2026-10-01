"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, Section } from "@/components/page";
import { getJson, send } from "@/lib/api";
import { clearLocalCaches } from "@/lib/cache-keys";
import { clearHomeMemory } from "@/lib/home-cache";
import { showToast } from "@/lib/toast";

const OFFSET_OPTIONS = [
  { value: 7, label: "7일 전" },
  { value: 3, label: "3일 전" },
  { value: 1, label: "1일 전" },
  { value: 0, label: "당일" },
];

type Settings = { notifyTime: string; notifyOffsets: number[]; notifyTodos: boolean };

/** 이 기기의 알림 상태 */
type DeviceState =
  | "checking"
  | "unsupported" // 브라우저가 푸시 미지원 (아이폰은 홈 화면 앱에서만 지원)
  | "no-worker" // 서비스워커 없음 (개발 모드)
  | "denied" // 사용자가 알림 권한 거부
  | "off"
  | "on";

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return { reg, sub: (await reg?.pushManager.getSubscription()) ?? null };
}

const DEVICE_TEXT: Record<Exclude<DeviceState, "checking" | "on" | "off">, string> = {
  unsupported: "이 브라우저는 알림을 지원하지 않아요. 아이폰은 사파리에서 공유 > 홈 화면에 추가로 설치한 앱에서만 받을 수 있어요.",
  "no-worker": "개발 모드에서는 서비스워커가 꺼져 있어 알림을 켤 수 없어요. 배포된 앱에서 켜주세요.",
  denied: "알림 권한이 차단돼 있어요. 브라우저나 휴대폰 설정에서 이 사이트의 알림을 허용해주세요.",
};

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-60"
      style={{ background: checked ? "var(--navy)" : "var(--rule)" }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]"
        style={{ left: checked ? "1.375rem" : "0.125rem" }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [device, setDevice] = useState<DeviceState>("checking");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await getJson<Settings>("/api/settings");
    if (data) setSettings(data);
  }

  async function checkDevice() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setDevice("unsupported");
    }
    if (Notification.permission === "denied") return setDevice("denied");
    const { reg, sub } = await currentSubscription();
    if (!reg) return setDevice("no-worker");
    setDevice(sub ? "on" : "off");
  }

  useEffect(() => {
    load();
    checkDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = await getJson<{ publicKey: string }>("/api/push/key");
      const { reg } = await currentSubscription();
      if (!key || !reg) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(key.publicKey),
      });
      if (await send("/api/push/subscription", "POST", sub.toJSON())) {
        setDevice("on");
        showToast("이 기기에서 알림을 받아요");
      }
    } catch {
      showToast("알림을 켜지 못했어요. 다시 시도하세요.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const { sub } = await currentSubscription();
      if (sub) {
        await send("/api/push/subscription", "DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setDevice("off");
      showToast("이 기기 알림을 껐어요");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) showToast("테스트 알림을 보내지 못했어요.", { tone: "error" });
      else if (!data?.devices) showToast("알림을 켠 기기가 없어요.");
      else showToast(`${data.sent}/${data.devices}개 기기로 보냈어요`);
    } finally {
      setBusy(false);
    }
  }

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    if (!(await send("/api/settings", "PATCH", patch))) load();
  }

  function toggleOffset(value: number) {
    if (!settings) return;
    const has = settings.notifyOffsets.includes(value);
    save({
      notifyOffsets: has ? settings.notifyOffsets.filter((d) => d !== value) : [...settings.notifyOffsets, value],
    });
  }

  async function lock() {
    if (!confirm("잠글까요? 다시 열려면 PIN이 필요합니다.")) return;
    if (!(await send("/api/auth/logout", "POST"))) return;
    clearLocalCaches();
    clearHomeMemory();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="설정" />

      <Section title="알림" tone="navy">
        <div className="row justify-between">
          <div>
            <p className="font-medium">이 기기에서 받기</p>
            <p className="text-[13px] text-pencil">
              {device === "on" ? "켜짐" : device === "off" ? "꺼짐" : device === "checking" ? "확인 중" : "사용할 수 없음"}
            </p>
          </div>
          {(device === "on" || device === "off") && (
            <Switch
              label="이 기기에서 알림 받기"
              checked={device === "on"}
              disabled={busy}
              onChange={device === "on" ? turnOff : turnOn}
            />
          )}
        </div>
        {device !== "on" && device !== "off" && device !== "checking" && (
          <p className="mt-3 rounded-xl bg-navy-soft p-3 text-[13px] text-navy">{DEVICE_TEXT[device]}</p>
        )}

        <div className="row justify-between">
          <label htmlFor="notify-time" className="font-medium">
            알림 시각
          </label>
          <input
            id="notify-time"
            type="time"
            value={settings?.notifyTime ?? ""}
            disabled={!settings}
            onChange={(e) => e.target.value && save({ notifyTime: e.target.value })}
            className="field field-sm w-28 text-right"
          />
        </div>

        <div className="border-b py-3">
          <p className="font-medium">알림 시점</p>
          <p className="mb-3 text-[13px] text-pencil">일정 시작일 기준으로 골라둔 날 알림 시각에 보내요</p>
          <div className="flex flex-wrap gap-2">
            {OFFSET_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={!settings}
                onClick={() => toggleOffset(o.value)}
                aria-pressed={settings?.notifyOffsets.includes(o.value) ?? false}
                className="chip"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row justify-between">
          <div>
            <p className="font-medium">할 일 알림</p>
            <p className="text-[13px] text-pencil">마감일 당일 알림 시각에 안 끝난 할 일을 알려줘요</p>
          </div>
          <Switch
            label="할 일 알림"
            checked={settings?.notifyTodos ?? false}
            disabled={!settings}
            onChange={() => settings && save({ notifyTodos: !settings.notifyTodos })}
          />
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={sendTest}
            disabled={busy || device !== "on"}
            className="h-10 rounded-full border px-4 text-sm font-medium text-navy disabled:opacity-50"
          >
            테스트 알림 보내기
          </button>
        </div>
      </Section>

      <Section title="보안">
        <div className="row justify-between">
          <div>
            <p className="font-medium">잠그기</p>
            <p className="text-[13px] text-pencil">이 기기에서 로그아웃해요. 다시 열려면 PIN이 필요해요.</p>
          </div>
          <button type="button" onClick={lock} className="h-9 flex-none rounded-full border px-4 text-sm font-medium">
            잠그기
          </button>
        </div>
      </Section>
    </>
  );
}
