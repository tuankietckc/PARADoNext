-- PARADoNext — View Task bên trong trang Project / Area (giống linked database của Notion)
--
--   section 'project' : view dùng cho khối Tasks trong MỌI trang Project (lọc theo Project đang mở)
--   section 'area'    : như trên cho trang Area
--   Tuỳ chỉnh (lọc, sắp xếp, nhóm, cột, bố cục…) lưu 1 lần, áp dụng cho mọi Project / Area.
-- Chạy lại nhiều lần không lỗi.

alter table public.saved_views drop constraint if exists saved_views_section_check;
alter table public.saved_views add constraint saved_views_section_check
  check (section in ('tasks', 'schedule', 'list', 'project', 'area'));

create or replace function public.seed_para_task_views(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.saved_views where user_id = p_user and section = 'project') then
    insert into public.saved_views
      (user_id, name, icon, description, filters, sorts, group_by, view_type, section, calendar_field, is_system, sort_order)
    values
      (p_user, 'Project Tasks', 'circle-dashed', 'Việc chưa xong của Project này.',
        '[{"field":"complete","operator":"eq","value":false}]'::jsonb, '[]'::jsonb,
        null, 'table', 'project', 'due_at', true, 61),
      (p_user, 'Completed Tasks', 'check-circle', 'Việc đã xong của Project này, mới xong trước.',
        '[{"field":"complete","operator":"eq","value":true}]'::jsonb, '[{"field":"end_at","direction":"desc"}]'::jsonb,
        null, 'table', 'project', 'due_at', true, 62);
  end if;

  if not exists (select 1 from public.saved_views where user_id = p_user and section = 'area') then
    insert into public.saved_views
      (user_id, name, icon, description, filters, sorts, group_by, view_type, section, calendar_field, is_system, sort_order)
    values
      (p_user, 'Area Tasks', 'circle-dashed', 'Việc chưa xong thuộc Area này, nhóm theo Project.',
        '[{"field":"complete","operator":"eq","value":false}]'::jsonb, '[]'::jsonb,
        'project_id', 'table', 'area', 'due_at', true, 71),
      (p_user, 'Completed Tasks', 'check-circle', 'Việc đã xong thuộc Area này, mới xong trước.',
        '[{"field":"complete","operator":"eq","value":true}]'::jsonb, '[{"field":"end_at","direction":"desc"}]'::jsonb,
        null, 'table', 'area', 'due_at', true, 72);
  end if;
end;
$$;

-- User đã có
select public.seed_para_task_views(u.id) from auth.users u;

-- User mới: thêm 1 dòng perform vào trigger tạo view mặc định
do $$
declare
  body text;
begin
  select pg_get_functiondef('public.seed_system_views_for_user()'::regprocedure) into body;
  if position('seed_para_task_views' in body) = 0 then
    body := replace(body, 'perform public.seed_tasks_list_views(new.id);',
                          'perform public.seed_tasks_list_views(new.id);' || chr(10) || '  perform public.seed_para_task_views(new.id);');
    execute body;
  end if;
end;
$$;
