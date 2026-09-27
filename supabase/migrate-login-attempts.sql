-- PIN 로그인 실패 기록. 키는 IP, 또는 전체 합산용 '*'.
-- 다른 테이블처럼 RLS on + 정책 없음 = service_role만 접근.

create table if not exists note_login_attempts (
  key text primary key,
  fail_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table note_login_attempts enable row level security;
