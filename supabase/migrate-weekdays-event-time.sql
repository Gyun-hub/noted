-- 반복 요일 + 일정 시간 추가. schema.sql 재실행하면 데이터가 날아가니 이것만 실행.
-- 기존 반복 할 일은 weekdays null = 매일로 유지, 기존 일정은 event_time null = 종일.

alter table note_recurring_todos add column if not exists weekdays smallint[];
alter table note_events add column if not exists event_time time;
