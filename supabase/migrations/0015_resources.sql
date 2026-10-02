-- PARADoNext — Resources (chữ R trong PARA), giống bảng "All Resources" trong Notion
--
--   Bảng resources đã có từ 0001 (title, content, url, area_id, project_id, archived).
--   Thêm: kind (Video / Book / Article / Course / Khác), creator, topics (tag, dùng chung với Notes),
--         review (đánh giá 1–5 sao), minutes (độ dài), finished (đã xem/đọc xong).
-- Chạy lại nhiều lần không lỗi.

alter table public.resources add column if not exists kind text not null default 'article';
alter table public.resources add column if not exists creator text;
alter table public.resources add column if not exists topics text[] not null default '{}';
alter table public.resources add column if not exists review smallint;
alter table public.resources add column if not exists minutes numeric;
alter table public.resources add column if not exists finished boolean not null default false;

alter table public.resources drop constraint if exists resources_kind_check;
alter table public.resources add constraint resources_kind_check
  check (kind in ('video', 'book', 'article', 'course', 'other'));

alter table public.resources drop constraint if exists resources_review_check;
alter table public.resources add constraint resources_review_check
  check (review is null or review between 1 and 5);

alter table public.resources drop constraint if exists resources_minutes_check;
alter table public.resources add constraint resources_minutes_check
  check (minutes is null or minutes >= 0);

create index if not exists resources_user_created_idx on public.resources (user_id, archived, created_at desc);
create index if not exists resources_topics_idx on public.resources using gin (topics);

-- Tự cập nhật updated_at khi sửa
drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

-- RLS đã bật từ 0001; tạo lại policy cho chắc
alter table public.resources enable row level security;
drop policy if exists "resources: owner full access" on public.resources;
create policy "resources: owner full access" on public.resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
