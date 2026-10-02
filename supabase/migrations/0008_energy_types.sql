-- PARADoNext — "Năng lượng" = kiểu việc: Flow · Quick · Easy · Personal (chọn 1, có thể để trống)
--
--   • tasks.energy_level: enum low|medium|high  →  text flow|quick|easy|personal (nullable)
--   • Bỏ tasks.estimated_minutes (thời gian dự kiến) — thời gian thật vẫn tự tính từ Bắt đầu → Kết thúc
--   • Saved views đang lọc / sắp theo 2 cột cũ được chuyển sang giá trị mới
--   • Cho phép nhóm view theo Năng lượng
--
-- Chuyển dữ liệu cũ: high → flow · low → easy · ≤ 15 phút dự kiến → quick · Area tên "Personal" → personal.
-- Chạy lại nhiều lần không lỗi.

do $$
begin
  -- Chỉ chuyển khi cột còn là kiểu enum cũ
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'energy_level' and data_type = 'USER-DEFINED'
  ) then
    alter table public.tasks add column energy_new text;

    update public.tasks t set energy_new = case
      when t.energy_level::text = 'high' then 'flow'
      when t.energy_level::text = 'low' then 'easy'
      when t.estimated_minutes is not null and t.estimated_minutes <= 15 then 'quick'
      when exists (select 1 from public.areas a where a.id = t.area_id and lower(a.name) = 'personal') then 'personal'
    end;

    alter table public.tasks drop column energy_level;
    alter table public.tasks rename column energy_new to energy_level;
  end if;
end $$;

alter table public.tasks drop column if exists estimated_minutes;
drop type if exists public.energy_level;

alter table public.tasks drop constraint if exists tasks_energy_level_check;
alter table public.tasks add constraint tasks_energy_level_check
  check (energy_level is null or energy_level in ('flow', 'quick', 'easy', 'personal'));

-- ---------- Saved views ----------
-- Giá trị cũ trong bộ lọc: low → easy, high → flow, medium → bỏ
create or replace function public._pdn_map_energy(v jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(v) = 'array' then coalesce((
      select jsonb_agg(case e #>> '{}' when 'low' then '"easy"'::jsonb when 'high' then '"flow"'::jsonb else e end)
      from jsonb_array_elements(v) e
      where e #>> '{}' <> 'medium'
    ), '[]'::jsonb)
    when v #>> '{}' = 'low' then '"easy"'::jsonb
    when v #>> '{}' = 'high' then '"flow"'::jsonb
    else v
  end
$$;

update public.saved_views sv set filters = coalesce((
  select jsonb_agg(
    case when f ->> 'field' = 'energy_level' and f ? 'value'
      then jsonb_set(f, '{value}', public._pdn_map_energy(f -> 'value'))
      else f end
    order by ord)
  from jsonb_array_elements(sv.filters) with ordinality as x(f, ord)
  where f ->> 'field' <> 'estimated_minutes'
    and not (f ->> 'field' = 'energy_level' and f ->> 'value' = 'medium')
), '[]'::jsonb)
where sv.filters::text like '%estimated_minutes%' or sv.filters::text like '%energy_level%';

update public.saved_views sv set sorts = coalesce((
  select jsonb_agg(s order by ord)
  from jsonb_array_elements(sv.sorts) with ordinality as x(s, ord)
  where s ->> 'field' not in ('estimated_minutes', 'energy_level')
), '[]'::jsonb)
where sv.sorts::text like '%estimated_minutes%' or sv.sorts::text like '%energy_level%';

drop function public._pdn_map_energy(jsonb);

alter table public.saved_views drop constraint if exists saved_views_group_by_check;
alter table public.saved_views add constraint saved_views_group_by_check
  check (group_by is null or group_by in ('area_id', 'project_id', 'state', 'importance', 'urgency', 'energy_level'));
