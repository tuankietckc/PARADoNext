-- PARADoNext — Lưu cấu hình hiển thị (view Areas, view Projects…) để đồng bộ giữa các máy
--   key   : tên cấu hình, vd 'areas-view', 'projects-view'
--   value : JSON cấu hình (tab, bố cục, cột, sắp xếp, bộ lọc…)
-- Chỉ là cách hiển thị, không chứa dữ liệu công việc. Chạy lại nhiều lần không lỗi.

create table if not exists public.ui_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.ui_prefs enable row level security;

drop policy if exists "ui_prefs: owner full access" on public.ui_prefs;
create policy "ui_prefs: owner full access" on public.ui_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
