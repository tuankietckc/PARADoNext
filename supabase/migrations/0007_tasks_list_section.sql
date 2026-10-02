-- PARADoNext — Mục "Tasks List" (trên cùng trang Tasks) + nhóm theo (group by)
--
--   section  : thêm 'tasks' → Tasks List (trên) · Work Schedule · Work Summary ('list', dưới)
--   group_by : view bảng nhóm task theo area_id | project_id | state | importance | urgency

alter table public.saved_views drop constraint if exists saved_views_section_check;
alter table public.saved_views add constraint saved_views_section_check
  check (section in ('tasks', 'schedule', 'list'));

alter table public.saved_views drop constraint if exists saved_views_group_by_check;
alter table public.saved_views add constraint saved_views_group_by_check
  check (group_by is null or group_by in ('area_id', 'project_id', 'state', 'importance', 'urgency'));

-- 3 view của Tasks List cho 1 user (chạy lại không bị nhân đôi)
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
    (p_user, 'Tasks today', 'circle-check', 'Việc chưa xong có hạn hôm nay.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, 'table', 'tasks', 'due_at', true, 51),
    (p_user, 'Tasks to context', 'arrow-right', 'Việc hôm nay, nhóm theo Area — làm theo ngữ cảnh, xong việc nhà rồi mới sang việc công ty.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"today"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      'area_id', 'table', 'tasks', 'due_at', true, 52),
    (p_user, 'Tomorrow', 'cloud-sun', 'Việc chưa xong có hạn ngày mai — chuẩn bị trước.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"eq","value":"tomorrow"}]'::jsonb,
      '[{"field":"importance","direction":"desc"}]'::jsonb,
      null, 'table', 'tasks', 'due_at', true, 53);
end;
$$;

-- User đã có
select public.seed_tasks_list_views(u.id) from auth.users u;

-- User mới: trigger gọi thêm hàm trên. Giữ nguyên thân trigger của 0006, chỉ thêm 1 dòng perform.
do $$
declare
  body text;
begin
  select pg_get_functiondef('public.seed_system_views_for_user()'::regprocedure) into body;
  if position('seed_tasks_list_views' in body) = 0 then
    body := replace(body, 'perform public.seed_schedule_views(new.id);',
                          'perform public.seed_schedule_views(new.id);' || chr(10) || '  perform public.seed_tasks_list_views(new.id);');
    execute body;
  end if;
end;
$$;
