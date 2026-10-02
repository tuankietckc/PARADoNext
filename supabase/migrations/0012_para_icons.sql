-- PARADoNext — Icon tuỳ chỉnh cho Project / Area (emoji hoặc link ảnh https://…)
-- Chạy lại nhiều lần không lỗi.
alter table public.projects add column if not exists icon text;
alter table public.areas add column if not exists icon text;
