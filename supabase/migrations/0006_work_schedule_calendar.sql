-- PARADoNext — Mục "Work Schedule": view dạng lịch (tuần / tháng) trong trang Tasks
--
--   view_type      : 'table' | 'calendar_week' | 'calendar_month'   (bố cục của view)
--   section        : 'list' (Task list) | 'schedule' (Work Schedule) — view nằm ở mục nào
--   calendar_field : task hiện trên lịch theo ngày nào: 'due_at' (Hạn) | 'start_at' | 'end_at'

-- 1. view_type: enum → text + check (thêm giá trị mới an toàn trong 1 lần chạy)
alter table public.saved_views alter column view_type drop default;
alter table public.saved_views alter column view_type type text using view_type::text;
alter table public.saved_views alter column view_type set default 'table';
alter table public.saved_views drop constraint if exists saved_views_view_type_check;
alter table public.saved_views add constraint saved_views_view_type_check
  check (view_type in ('table', 'calendar_week', 'calendar_month'));
drop type if exists public.view_type;

-- 2. Mục chứa view + trường ngày cho lịch
alter table public.saved_views add column if not exists section text not null default 'list';
alter table public.saved_views drop constraint if exists saved_views_section_check;
alter table public.saved_views add constraint saved_views_section_check check (section in ('list', 'schedule'));

alter table public.saved_views add column if not exists calendar_field text not null default 'due_at';
alter table public.saved_views drop constraint if exists saved_views_calendar_field_check;
alter table public.saved_views add constraint saved_views_calendar_field_check
  check (calendar_field in ('due_at', 'start_at', 'end_at'));

-- 3. Hàm tạo 3 view Work Schedule cho 1 user (dùng cho user cũ lẫn user mới)
create or replace function public.seed_schedule_views(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.saved_views where user_id = p_user and section = 'schedule') then
    return; -- đã có rồi thì thôi (chạy lại migration không bị nhân đôi)
  end if;

  insert into public.saved_views
    (user_id, name, icon, description, filters, sorts, view_type, section, calendar_field, is_system, sort_order)
  values
    (p_user, 'Week''s Tasks', 'sun', 'Lịch tuần này — chỉ những việc chưa làm xong.',
      '[{"field":"complete","operator":"eq","value":false}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_week', 'schedule', 'due_at', true, 101),
    (p_user, 'All this week', 'calendar-days', 'Lịch tuần này — tất cả việc, kể cả đã xong.',
      '[]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_week', 'schedule', 'due_at', true, 102),
    (p_user, 'Monthly tasks', 'calendar', 'Lịch cả tháng — nhìn tổng quan khối lượng việc.',
      '[]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_month', 'schedule', 'due_at', true, 103);
end;
$$;

-- User đã có: tạo ngay
select public.seed_schedule_views(u.id) from auth.users u;

-- User mới: trigger tạo view gọi thêm hàm trên (giữ nguyên 8 view Task list + ghi chú của 0005)
create or replace function public.seed_system_views_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_views (user_id, name, icon, description, filters, sorts, group_by, visible_columns, is_system, sort_order)
  values
    (new.id, 'Today', 'calendar', 'Việc chưa xong có hạn hôm nay — bắt đầu từ đây.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 1),
    (new.id, 'Tomorrow', 'calendar-plus', 'Việc chưa xong có hạn ngày mai — xem trước để chuẩn bị.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"tomorrow"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 2),
    (new.id, 'This Week', 'calendar-range', 'Việc chưa xong có hạn trong tuần này (thứ 2 → chủ nhật).',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","due_at","importance","project_id"]'::jsonb, true, 3),
    (new.id, 'No Date', 'calendar-off', 'Việc chưa có ngày bắt đầu lẫn hạn — xếp lịch cho chúng khi rảnh.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"},{"field":"due_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 4),
    (new.id, 'Overdue', 'alert-triangle', 'Việc đã quá hạn mà chưa xong — làm ngay, dời hạn, hoặc xoá.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"lt","value":"now"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","due_at","importance","project_id"]'::jsonb, true, 5),
    (new.id, 'Open Loops', 'circle-dashed', 'Việc chưa xong và chưa có hạn — những thứ còn lơ lửng trong đầu.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 6),
    (new.id, 'Completed', 'check-circle', 'Việc đã hoàn thành — nhìn lại những gì bạn đã làm được.',
      '[{"field":"complete","operator":"eq","value":true}]'::jsonb,
      '[{"field":"due_at","direction":"desc"}]'::jsonb,
      null, '["task_name","due_at","project_id"]'::jsonb, true, 7),
    (new.id, 'All Tasks', 'list', 'Tất cả task, không lọc.',
      '[]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","start_at","due_at","importance","urgency","project_id","area_id"]'::jsonb, true, 8);

  perform public.seed_schedule_views(new.id);
  return new;
end;
$$;
