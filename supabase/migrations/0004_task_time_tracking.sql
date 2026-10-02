-- PARADoNext — Tự tính thời gian làm task (giống cột công thức Minutes/Hours trong Notion)
--
--   end_at          : thời điểm kết thúc — TỰ ĐIỀN khi task được đánh dấu hoàn thành
--   actual_minutes  : số phút = end_at − start_at   (cột tự tính, không ghi tay được)
--   actual_hours    : số giờ  = end_at − start_at   (làm tròn 2 chữ số)
--
-- Nếu task không có start_at thì tính từ lúc tạo task (created_at) — giống template
-- Notion đặt Start Time mặc định là ngày tạo.

alter table public.tasks add column if not exists end_at timestamptz;

-- actual_minutes cũ là cột nhập tay → đổi thành cột tự tính
alter table public.tasks drop column if exists actual_minutes;

alter table public.tasks add column actual_minutes int generated always as (
  case
    when end_at is not null and end_at >= coalesce(start_at, created_at)
    then floor(extract(epoch from (end_at - coalesce(start_at, created_at))) / 60)::int
  end
) stored;

alter table public.tasks add column actual_hours numeric(10, 2) generated always as (
  case
    when end_at is not null and end_at >= coalesce(start_at, created_at)
    then round((extract(epoch from (end_at - coalesce(start_at, created_at))) / 3600)::numeric, 2)
  end
) stored;

-- Tự điền mốc thời gian theo trạng thái:
--   • chuyển sang "Đang làm" mà chưa có giờ bắt đầu  → start_at = bây giờ
--   • hoàn thành mà chưa có giờ kết thúc             → end_at   = bây giờ
--   • bỏ hoàn thành                                  → xoá end_at
create or replace function public.task_auto_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state = 'in_progress' and new.start_at is null
     and (tg_op = 'INSERT' or old.state is distinct from 'in_progress') then
    new.start_at := now();
  end if;

  if new.complete and new.end_at is null
     and (tg_op = 'INSERT' or not old.complete) then
    new.end_at := now();
  end if;

  if tg_op = 'UPDATE' and old.complete and not new.complete then
    new.end_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_auto_timestamps on public.tasks;
create trigger trg_tasks_auto_timestamps
  before insert or update on public.tasks
  for each row execute function public.task_auto_timestamps();
