-- PARADoNext — Ghi chú cho từng view (giải thích view đang hiển thị dữ liệu gì)

alter table public.saved_views add column if not exists description text;

-- Điền ghi chú mặc định cho 8 view hệ thống đã có (chỉ khi chưa có ghi chú)
update public.saved_views set description = case name
    when 'Today'      then 'Việc chưa xong có hạn hôm nay — bắt đầu từ đây.'
    when 'Tomorrow'   then 'Việc chưa xong có hạn ngày mai — xem trước để chuẩn bị.'
    when 'This Week'  then 'Việc chưa xong có hạn trong tuần này (thứ 2 → chủ nhật).'
    when 'No Date'    then 'Việc chưa có ngày bắt đầu lẫn hạn — xếp lịch cho chúng khi rảnh.'
    when 'Overdue'    then 'Việc đã quá hạn mà chưa xong — làm ngay, dời hạn, hoặc xoá.'
    when 'Open Loops' then 'Việc chưa xong và chưa có hạn — những thứ còn lơ lửng trong đầu.'
    when 'Completed'  then 'Việc đã hoàn thành — nhìn lại những gì bạn đã làm được.'
    when 'All Tasks'  then 'Tất cả task, không lọc.'
  end
where is_system and description is null;

-- User mới: tạo 8 view hệ thống kèm ghi chú (giữ search_path an toàn như migration 0003)
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

  return new;
end;
$$;
