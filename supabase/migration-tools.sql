-- 써볼 도구 (Claude 플러그인·MCP·스킬 등). Supabase 대시보드 > SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.

create table if not exists note_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null default '',
  -- 자유 분류 (플러그인, MCP, 스킬 …)
  kind text not null default '',
  note text not null default '',
  -- want = 써볼 것, using = 쓰는 중, dropped = 안 씀
  status text not null default 'want' check (status in ('want', 'using', 'dropped')),
  created_at timestamptz not null default now()
);

alter table note_tools enable row level security;
