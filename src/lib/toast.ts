// 앱 전역 토스트 스토어. <Toaster />가 구독해서 그림.

export type Toast = {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; onClick: () => void };
};

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function showToast(
  message: string,
  { tone = "info", action, duration = 3000 }: { tone?: Toast["tone"]; action?: Toast["action"]; duration?: number } = {},
) {
  const id = ++seq;
  // 같은 에러가 연달아 쌓이지 않게 최대 3개
  toasts = [...toasts.filter((t) => t.message !== message), { id, message, tone, action }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
