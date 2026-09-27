-- 기존 DB에 할 일 날짜(due_date) 추가. schema.sql 재실행하면 데이터가 날아가니 이것만 실행.
-- due_date가 null인 기존 할 일은 캘린더에 안 뜨고 today에만 계속 보임.

alter table note_todos add column if not exists due_date date;
create index if not exists note_todos_due_date_idx on note_todos (due_date);
