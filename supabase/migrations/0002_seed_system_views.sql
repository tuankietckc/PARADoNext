-- PARADoNext — Seed các Saved View hệ thống khi user mới đăng ký
-- Dùng trigger on auth.users insert để tự tạo 8 system view (README mục 7 & 8.3)

create or replace function seed_system_views_for_user()
returns trigger as $$
begin
  insert into saved_views (user_id, name, icon, filters, sorts, group_by, visible_columns, is_system, sort_order)
  values
    (new.id, 'Today', 'calendar', 
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 1),

    (new.id, 'Tomorrow', 'calendar-plus',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"tomorrow"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","start_at","importance","project_id"]'::jsonb, true, 2),

    (new.id, 'This Week', 'calendar-range',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","due_at","importance","project_id"]'::jsonb, true, 3),

    (new.id, 'No Date', 'calendar-off',
      '[{"field":"complete","operator":"eq","value":false},{"field":"start_at","operator":"is_null"},{"field":"due_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 4),

    (new.id, 'Overdue', 'alert-triangle',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"lt","value":"now"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","due_at","importance","project_id"]'::jsonb, true, 5),

    (new.id, 'Open Loops', 'circle-dashed',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"is_null"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, '["task_name","importance","project_id"]'::jsonb, true, 6),

    (new.id, 'Completed', 'check-circle',
      '[{"field":"complete","operator":"eq","value":true}]'::jsonb,
      '[{"field":"due_at","direction":"desc"}]'::jsonb,
      null, '["task_name","due_at","project_id"]'::jsonb, true, 7),

    (new.id, 'All Tasks', 'list',
      '[]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb,
      null, '["task_name","start_at","due_at","importance","urgency","project_id","area_id"]'::jsonb, true, 8);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger chạy mỗi khi có user mới được tạo trong Supabase Auth
create trigger trg_seed_system_views
  after insert on auth.users
  for each row execute function seed_system_views_for_user();
