"use client";

import { useEffect } from "react";

// dev 모드엔 Serwist가 꺼져 있는데, 예전에 운영 빌드로 등록된 서비스워커가 남아 있으면
// 요청을 가로채 운영 빌드 파일(main-app-xxxx.js 등)을 찾다가 404가 남. 개발 중에만 정리.
export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !("serviceWorker" in navigator)) return;

    (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;
      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // 이 페이지는 아직 예전 서비스워커가 잡고 있으니 한 번 새로고침
      location.reload();
    })();
  }, []);

  return null;
}
