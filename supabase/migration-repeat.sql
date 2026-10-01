-- 반복 일정 + 할 일 알림. Supabase 대시보드 > SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.

-- 일정 반복: null = 반복 안 함. repeat_until = 이 날짜까지(포함) 반복, null = 끝없이
alter table note_events add column if not exists repeat text;
alter table note_events add column if not exists repeat_until date;

alter table note_events drop constraint if exists note_events_repeat_check;
alter table note_events add constraint note_events_repeat_check
  check (repeat is null or repeat in ('weekly', 'monthly', 'yearly'));

alter table note_events drop constraint if exists note_events_repeat_until_check;
alter table note_events add constraint note_events_repeat_until_check
  check (repeat_until is null or (repeat is not null and repeat_until >= event_date));

-- 반복 일정 알림 기록은 기존 note_push_log 그대로 씀 (event_date = 회차 날짜)

-- 마감일 당일 할 일 알림 켜기/끄기
alter table note_settings add column if not exists notify_todos boolean not null default true;

-- 보낸 할 일 알림 기록. 마감일을 바꾸면 새 날짜에 다시 알림
create table if not exists note_push_todo_log (
  todo_id uuid not null references note_todos(id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (todo_id, due_date)
);

alter table note_push_todo_log enable row level security;
