-- PARADoNext — View Task & Project cho trang Weekly Review
--
--   section 'review' : bộ view Task riêng của trang Review (lọc, sắp xếp, nhóm, cột, lịch… như trang Tasks)
--     • Xong tuần này          • Chưa xong tuần này     • Quá hạn
--     • Xong tuần trước         • Xong theo Area (tuần)  • Lịch tuần • Lịch tháng
--   projects.completed_at : thời điểm Project được đánh dấu Completed (tự điền) — để xem "hoàn thành tuần này"
-- Chạy lại nhiều lần không lỗi.

alter table public.saved_views drop constraint if exists saved_views_section_check;
alter table public.saved_views add constraint saved_views_section_check
  check (section in ('tasks', 'schedule', 'list', 'project', 'area', 'review'));

-- ---------------------------------------------------------------------------
-- Project: thời điểm hoàn thành
-- ---------------------------------------------------------------------------
alter table public.projects add column if not exists completed_at timestamptz;

create or replace function public.project_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed and (tg_op = 'INSERT' or not coalesce(old.completed, false)) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.completed then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_completed_at on public.projects;
create trigger trg_projects_completed_at
  before insert or update of completed on public.projects
  for each row execute function public.project_completed_at();

-- Project đã hoàn thành từ trước: lấy lần sửa cuối làm mốc
update public.projects set completed_at = updated_at where completed and completed_at is null;

-- ---------------------------------------------------------------------------
-- View Task mặc định cho trang Review
-- ---------------------------------------------------------------------------
create or replace function public.seed_review_views(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.saved_views where user_id = p_user and section = 'review') then
    return;
  end if;
  insert into public.saved_views
    (user_id, name, icon, description, filters, sorts, group_by, view_type, section, calendar_field, is_system, sort_order)
  values
    (p_user, 'Xong tuần này', 'check-circle', 'Task đã hoàn thành trong tuần này, mới xong trước.',
      '[{"field":"complete","operator":"eq","value":true},{"field":"end_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"end_at","direction":"desc"}]'::jsonb, null, 'table', 'review', 'end_at', true, 81),
    (p_user, 'Chưa xong tuần này', 'circle-dashed', 'Task có hạn trong tuần này nhưng chưa xong.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb, null, 'table', 'review', 'due_at', true, 82),
    (p_user, 'Quá hạn', 'alert', 'Task chưa xong mà đã qua hạn — dời hạn, làm ngay hoặc bỏ.',
      '[{"field":"complete","operator":"eq","value":false},{"field":"due_at","operator":"within","value":"now"}]'::jsonb,
      '[{"field":"due_at","direction":"asc"}]'::jsonb, null, 'table', 'review', 'due_at', true, 83),
    (p_user, 'Xong tuần trước', 'history', 'Task đã hoàn thành tuần trước — để so sánh.',
      '[{"field":"complete","operator":"eq","value":true},{"field":"end_at","operator":"within","value":"last_week"}]'::jsonb,
      '[{"field":"end_at","direction":"desc"}]'::jsonb, null, 'table', 'review', 'end_at', true, 84),
    (p_user, 'Xong theo Area', 'layers', 'Task hoàn thành tuần này, nhóm theo Area — tuần này dồn sức vào đâu.',
      '[{"field":"complete","operator":"eq","value":true},{"field":"end_at","operator":"within","value":"this_week"}]'::jsonb,
      '[{"field":"end_at","direction":"desc"}]'::jsonb, 'area_id', 'table', 'review', 'end_at', true, 85),
    (p_user, 'Lịch tuần', 'calendar', 'Mọi task theo hạn, xem theo tuần.',
      '[]'::jsonb, '[]'::jsonb, null, 'calendar_week', 'review', 'due_at', true, 86),
    (p_user, 'Lịch tháng', 'calendar', 'Mọi task theo hạn, xem theo tháng.',
      '[]'::jsonb, '[]'::jsonb, null, 'calendar_month', 'review', 'due_at', true, 87);
end;
$$;

-- User đã có
select public.seed_review_views(u.id) from auth.users u;

-- User mới: thêm vào trigger tạo view mặc định
do $$
declare
  body text;
begin
  select pg_get_functiondef('public.seed_system_views_for_user()'::regprocedure) into body;
  if position('seed_review_views' in body) = 0 then
    body := replace(body, 'perform public.seed_tasks_list_views(new.id);',
                          'perform public.seed_tasks_list_views(new.id);' || chr(10) || '  perform public.seed_review_views(new.id);');
    execute body;
  end if;
end;
$$;
