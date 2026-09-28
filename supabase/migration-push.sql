-- 일정 푸시 알림. Supabase 대시보드 > SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- 다른 테이블처럼 RLS on + 정책 없음 = service_role(서버)만 접근.

-- 알림 설정. 단일 사용자라 한 줄(id = 1)만 씀
create table if not exists note_settings (
  id smallint primary key default 1 check (id = 1),
  notify_time time not null default '08:00',          -- 매일 이 시각(한국 시간)에 발송
  notify_offsets smallint[] not null default '{0,7}', -- 일정 며칠 전에 알릴지. 0 = 당일
  updated_at timestamptz not null default now()
);
insert into note_settings (id) values (1) on conflict (id) do nothing;

-- 알림 받을 기기(브라우저) 구독 정보
create table if not exists note_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- 보낸 알림 기록. 같은 일정을 같은 시점에 두 번 보내지 않게.
-- event_date 포함: 일정 날짜를 바꾸면 새 날짜 기준으로 다시 알림
create table if not exists note_push_log (
  event_id uuid not null references note_events(id) on delete cascade,
  days_before smallint not null,
  event_date date not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, days_before, event_date)
);

alter table note_settings enable row level security;
alter table note_push_subscriptions enable row level security;
alter table note_push_log enable row level security;
