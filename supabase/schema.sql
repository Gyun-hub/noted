-- noted (my-note) 전용 테이블. fit-log 테이블과 분리하기 위해 note_ 접두사 사용.
-- Supabase 대시보드 > SQL Editor 에서 실행.
--
-- 단일 유저 전용 앱. 인증은 Supabase Auth가 아니라 자체 PIN 세션(proxy.ts)이 처리하고,
-- 서버(Route Handler)만 service_role 키로 이 테이블에 접근한다.
-- RLS는 켜두지만 정책을 하나도 만들지 않는다 = anon/authenticated 키로는 아무것도 못 함,
-- service_role만 (RLS 자체를 우회하므로) 접근 가능. anon key가 노출돼도 안전.
--
-- 이전 스키마(user_id + Supabase Auth 기반) 대비 컬럼 구조가 바뀌어서 마이그레이션 아님,
-- 완전 재생성임. 기존 데이터 있으면 이 스크립트 실행 시 전부 날아감.

drop table if exists note_todo_logs;
drop table if exists note_todos;
drop table if exists note_products;
drop table if exists note_events;
drop table if exists note_ideas;
drop table if exists note_recurring_todo_logs;
drop table if exists note_recurring_todos;
drop table if exists note_login_attempts;

create table note_recurring_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  weekdays smallint[], -- 0(일)~6(토). null = 매일
  created_at timestamptz not null default now()
);

create table note_recurring_todo_logs (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references note_recurring_todos(id) on delete cascade,
  log_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (todo_id, log_date)
);

create table note_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

create table note_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table note_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time time, -- null = 종일
  created_at timestamptz not null default now()
);

create table note_ideas (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

-- PIN 로그인 실패 기록. 키는 IP, 또는 전체 합산용 '*'.
create table note_login_attempts (
  key text primary key,
  fail_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table note_recurring_todos enable row level security;
alter table note_login_attempts enable row level security;
alter table note_recurring_todo_logs enable row level security;
alter table note_todos enable row level security;
alter table note_products enable row level security;
alter table note_events enable row level security;
alter table note_ideas enable row level security;

create index if not exists note_events_date_idx on note_events (event_date);
create index if not exists note_todos_due_date_idx on note_todos (due_date);
