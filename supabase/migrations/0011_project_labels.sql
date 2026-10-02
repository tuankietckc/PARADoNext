-- PARADoNext — Status của Project giống Notion (chọn nhiều):
--   Fav · Completed · Archive  → dùng cột sẵn có is_favorite / completed / archived
--   On-going · Deadline · Moved the Needle → lưu trong cột mới labels
-- Chạy lại nhiều lần không lỗi.
alter table public.projects add column if not exists labels text[] not null default '{}';

alter table public.projects drop constraint if exists projects_labels_check;
alter table public.projects add constraint projects_labels_check
  check (labels <@ array['ongoing', 'deadline', 'moved_the_needle']::text[]);
