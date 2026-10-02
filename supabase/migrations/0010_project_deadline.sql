-- PARADoNext — Hạn (deadline) cho Project, để có view OVERDUE giống Notion
-- Chạy lại nhiều lần không lỗi.
alter table public.projects add column if not exists due_at timestamptz;
create index if not exists projects_user_due_idx on public.projects (user_id, due_at);
