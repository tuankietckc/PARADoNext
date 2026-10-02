-- PARADoNext — Ghi chú (Notes), giống bảng Quick Notes trong Notion
--
--   notes: tên, nội dung, 1 Area, 1 Project, nhiều Topics (tag tự do), lưu trữ (Archive)
--   Topics là tag dạng chữ (text[]) — gõ tên là có, không cần bảng riêng.
--   Bảng resources (tài nguyên) giữ nguyên để dùng sau.
-- Chạy lại nhiều lần không lỗi.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text,
  area_id uuid references public.areas(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  topics text[] not null default '{}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_created_idx on public.notes (user_id, archived, created_at desc);
create index if not exists notes_topics_idx on public.notes using gin (topics);

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

drop policy if exists "notes: owner full access" on public.notes;
create policy "notes: owner full access" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
