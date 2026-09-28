// OpenNext 워커(.open-next/worker.js, 빌드 시 생성)를 감싸서 Cron 핸들러 추가.
// Cron은 5분마다 /api/cron/notify 를 내부 호출하고, 실제 발송 여부(설정 시각, 중복)는 라우트가 판단.
import handler from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const worker = {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    const request = new Request("https://noted.internal/api/cron/notify", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
};

export default worker;
