-- PARADoNext — Chuyển các view từ lọc theo due_at sang start_at (ngày bắt đầu)
--
-- Yêu cầu người dùng: "Kiểm tra các view sẽ tính là từ ngày bắt đầu nhé"
--   - Tasks today   : complete=false, start_at = hôm nay
--   - Tasks to context: nhóm Area, importance desc, complete=false, start_at = hôm nay
--   - Tomorrow      : complete=false, start_at = ngày mai
--   - Today (Work Summary): complete=false, start_at = hôm nay
--   - Tomorrow (Work Summary): complete=false, start_at = ngày mai
--   - This Week     : complete=false, start_at trong tuần này
--   - Overdue       : complete=false, start_at < now (quá ngày bắt đầu mà chưa xong)
--   - Week's Tasks (Calendar): calendar_field = start_at

-- ===== 1. Tasks List (section = 'tasks') =====

-- Tasks today: start_at = today (thay vì due_at)
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
    description = 'Việc chưa xong có ngày bắt đầu là hôm nay.'
where is_system and name = 'Tasks today' and section = 'tasks';

-- Tasks to context: start_at = today, nhóm theo Area, importance desc
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
    description = 'Việc hôm nay, nhóm theo Area — làm theo ngữ cảnh, xong việc nhà rồi mới sang việc công ty.'
where is_system and name = 'Tasks to context' and section = 'tasks';

-- Tomorrow (Tasks List): start_at = tomorrow
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"tomorrow"}]'::jsonb,
    description = 'Việc chưa xong có ngày bắt đầu là ngày mai — chuẩn bị trước.'
where is_system and name = 'Tomorrow' and section = 'tasks';

-- ===== 2. Work Summary (section = 'list') =====

-- Today: start_at = today
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
    description = 'Việc chưa xong có ngày bắt đầu là hôm nay — bắt đầu từ đây.'
where is_system and name = 'Today' and section = 'list';

-- Tomorrow: start_at = tomorrow
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"tomorrow"}]'::jsonb,
    description = 'Việc chưa xong có ngày bắt đầu là ngày mai — xem trước để chuẩn bị.'
where is_system and name = 'Tomorrow' and section = 'list';

-- This Week: start_at within this_week
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"within","value":"this_week"}]'::jsonb,
    sorts = '[{"field":"start_at","direction":"asc"}]'::jsonb,
    description = 'Việc chưa xong có ngày bắt đầu trong tuần này (thứ 2 → chủ nhật).'
where is_system and name = 'This Week' and section = 'list';

-- No Date: chưa có start_at lẫn due_at
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"},{"field":"due_at","operator":"is_null"}]'::jsonb,
    description = 'Việc chưa có ngày bắt đầu lẫn hạn — xếp lịch cho chúng khi rảnh.'
where is_system and name = 'No Date' and section = 'list';

-- Overdue: start_at < now (quá ngày bắt đầu mà chưa xong)
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"lt","value":"now"}]'::jsonb,
    sorts = '[{"field":"start_at","direction":"asc"}]'::jsonb,
    description = 'Việc đã quá ngày bắt đầu mà chưa xong — làm ngay, dời lịch, hoặc xoá.'
where is_system and name = 'Overdue' and section = 'list';

-- Open Loops: chưa có start_at
update public.saved_views
set filters = '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"}]'::jsonb,
    description = 'Việc chưa xong và chưa có ngày bắt đầu — những thứ còn lơ lửng trong đầu.'
where is_system and name = 'Open Loops' and section = 'list';

-- Completed: giữ nguyên (sort theo start_at thay due_at)
update public.saved_views
set sorts = '[{"field":"start_at","direction":"desc"}]'::jsonb,
    description = 'Việc đã hoàn thành — nhìn lại những gì bạn đã làm được.'
where is_system and name = 'Completed' and section = 'list';

-- All Tasks: sort theo start_at
update public.saved_views
set sorts = '[{"field":"start_at","direction":"asc"}]'::jsonb
where is_system and name = 'All Tasks' and section = 'list';

-- ===== 3. Work Schedule (section = 'schedule') =====
-- Calendar hiện task theo ngày bắt đầu thay vì hạn
update public.saved_views
set calendar_field = 'start_at'
where is_system and section = 'schedule';

-- ===== 4. Cập nhật seed function cho user mới =====

-- 4a. Seed Tasks List views
create or replace function public.seed_tasks_list_views(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.saved_views where user_id = p_user and section = 'tasks') then
    return;
  end if;

  insert into public.saved_views
    (user_id, name, icon, description, filters, sorts, group_by, view_type, section, calendar_field, is_system, sort_order)
  values
    (p_user, 'Tasks today', 'circle-check', 'Việc chưa xong có ngày bắt đầu là hôm nay.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, 'table', 'tasks', 'start_at', true, 51),
    (p_user, 'Tasks to context', 'arrow-right', 'Việc hôm nay, nhóm theo Area — làm theo ngữ cảnh, xong việc nhà rồi mới sang việc công ty.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'area_id', 'table', 'tasks', 'start_at', true, 52),
    (p_user, 'Tomorrow', 'cloud-sun', 'Việc chưa xong có ngày bắt đầu là ngày mai — chuẩn bị trước.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"tomorrow"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, 'table', 'tasks', 'start_at', true, 53);
end;
$$;

-- 4b. Seed Schedule views
create or replace function public.seed_schedule_views(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.saved_views where user_id = p_user and section = 'schedule') then
    return;
  end if;

  insert into public.saved_views
    (user_id, name, icon, description, filters, sorts, view_type, section, calendar_field, is_system, sort_order)
  values
    (p_user, 'Week''s Tasks', 'sun', 'Lịch tuần này — chỉ những việc chưa làm xong.',
      '[{"field":"complete","operator":"eq","value":false}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_week', 'schedule', 'start_at', true, 101),
    (p_user, 'All this week', 'calendar-days', 'Lịch tuần này — tất cả việc, kể cả đã xong.',
      '[]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_week', 'schedule', 'start_at', true, 102),
    (p_user, 'Monthly tasks', 'calendar', 'Lịch cả tháng — nhìn tổng quan khối lượng việc.',
      '[]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'calendar_month', 'schedule', 'start_at', true, 103);
end;
$$;

-- 4c. Seed Work Summary views (cho user mới)
create or replace function public.seed_system_views_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_views (user_id, name, icon, description, filters, sorts, group_by, visible_columns, is_system, sort_order)
  values
    (new.id, 'Today', 'calendar', 'Việc chưa xong có ngày bắt đầu là hôm nay — bắt đầu từ đây.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 1),
    (new.id, 'Tomorrow', 'calendar-plus', 'Việc chưa xong có ngày bắt đầu là ngày mai — xem trước để chuẩn bị.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"eq","value":"tomorrow"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 2),
    (new.id, 'This Week', 'calendar-range', 'Việc chưa xong có ngày bắt đầu trong tuần này (thứ 2 → chủ nhật).',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"start_at","direction":"asc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 3),
    (new.id, 'No Date', 'calendar-off', 'Việc chưa có ngày bắt đầu lẫn hạn — xếp lịch cho chúng khi rảnh.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"},{"field":"due_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 4),
    (new.id, 'Overdue', 'alert-triangle', 'Việc đã quá ngày bắt đầu mà chưa xong — làm ngay, dời lịch, hoặc xoá.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"lt","value":"now"}]'::jsonb,
      '[{"field":"start_at","direction":"asc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 5),
    (new.id, 'Open Loops', 'circle-dashed', 'Việc chưa xong và chưa có ngày bắt đầu — những thứ còn lơ lửng trong đầu.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 6),
    (new.id, 'Completed', 'check-circle', 'Việc đã hoàn thành — nhìn lại những gì bạn đã làm được.',
      '[{"field":"complete","operator":"eq","value":true}]'::jsonb,
      '[{"field":"start_at","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","project_id"]'::jsonb, true, 7),
    (new.id, 'All Tasks', 'list', 'Tất cả task, không lọc.',
      '[]'::jsonb,
      '[{"field":"start_at","direction":"asc"}]'::jsonb,
      null, '["task_name","start_at","due_at","importance","urgency","project_id","area_id"]'::jsonb, true, 8);

  perform public.seed_schedule_views(new.id);
  perform public.seed_tasks_list_views(new.id);
  return new;
end;
$$;
