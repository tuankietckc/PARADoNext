-- PARADoNext — Sửa lỗi "Database error saving new user" khi đăng ký.
--
-- Nguyên nhân: Supabase Auth chạy trigger trên auth.users bằng role
-- supabase_auth_admin, có search_path = auth. Hàm cũ ghi "saved_views" không kèm
-- schema nên Postgres tìm auth.saved_views -> không tồn tại -> huỷ cả việc tạo user.
--
-- Cách sửa: ghi rõ public.saved_views và khoá search_path của hàm (khuyến nghị
-- của Supabase cho mọi hàm security definer).

create or replace function public.seed_system_views_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_views (user_id, name, icon, filters, sorts, group_by, visible_columns, is_system, sort_order)
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
$$;

-- Hàm dùng chung cho trigger updated_at: cũng khoá search_path cho an toàn.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
