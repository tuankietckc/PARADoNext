-- PARADoNext — Cập nhật ràng buộc loại tài nguyên (Resources) hỗ trợ thêm 'music'
-- Migration 0021

alter table public.resources drop constraint if exists resources_kind_check;
alter table public.resources add constraint resources_kind_check
  check (kind in ('video', 'book', 'article', 'course', 'music', 'other'));
