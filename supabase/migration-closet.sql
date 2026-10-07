-- 옷 기록 (fit-log에서 옮겨옴). Supabase 대시보드 > SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.

create table if not exists note_clothes (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('상의', '하의', '아우터', '원피스', '니트', '셔츠', '신발', '액세서리')),
  brand text not null,
  size_label text not null default '',
  -- {"어깨너비": 48, ...} cm
  measurements jsonb not null default '{}'::jsonb,
  -- {"총장": "tight", ...} 부위별 핏
  field_fit jsonb not null default '{}'::jsonb,
  fit_overall text not null default 'perfect'
    check (fit_overall in ('very_tight', 'tight', 'perfect', 'loose', 'very_loose')),
  fit_notes text not null default '',
  source text not null default '',
  purchase_date date,
  product_url text not null default '',
  image_url text not null default '',
  -- fit-log 기록 id. 가져오기를 다시 돌려도 중복 안 생기게
  legacy_id text unique,
  created_at timestamptz not null default now()
);

alter table note_clothes enable row level security;

-- fit-log(fitlog_sync)에 있던 기록 가져오기. fitlog_sync는 건드리지 않음
insert into note_clothes (
  category, brand, size_label, measurements, field_fit, fit_overall,
  fit_notes, source, purchase_date, product_url, image_url, legacy_id, created_at
)
select
  r->>'category',
  coalesce(nullif(trim(r->>'brand'), ''), '이름 없음'),
  coalesce(r->>'sizeLabel', ''),
  coalesce(r->'measurements', '{}'::jsonb),
  coalesce(r->'fieldFit', '{}'::jsonb),
  coalesce(r->>'fitOverall', 'perfect'),
  coalesce(r->>'fitNotes', ''),
  coalesce(r->>'source', ''),
  nullif(r->>'purchaseDate', '')::date,
  coalesce(r->>'productUrl', ''),
  coalesce(r->>'imageUrl', ''),
  r->>'id',
  coalesce((r->>'createdAt')::timestamptz, now())
from fitlog_sync s, jsonb_array_elements(s.records) r
where r->>'category' in ('상의', '하의', '아우터', '원피스', '니트', '셔츠', '신발', '액세서리')
on conflict (legacy_id) do nothing;
