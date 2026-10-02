-- PARADoNext — Task lặp lại ("Duplicate every…" giống Notion)
--
--   Đặt "Lặp lại" cho 1 task (task gốc) → mỗi chu kỳ app tạo 1 bản sao mới của task đó:
--   Day · Weekday (T2–T6) · Week · 2 Weeks · Month · 3 Months · 6 Months · Year
--
--   tasks.repeat_rule      : chu kỳ lặp (null = không lặp) — chỉ đặt trên task gốc
--   tasks.repeat_anchor    : mốc bắt đầu tính chu kỳ (tự đặt khi chọn/đổi chu kỳ)
--   tasks.repeat_last_on   : ngày của bản sao gần nhất đã tạo (tránh tạo trùng, kể cả khi đã xoá bản sao)
--   tasks.repeat_parent_id : bản sao trỏ về task gốc
--   tasks.repeat_on        : bản sao này là của ngày nào
--
--   Hàm generate_recurring_tasks(p_tz) được app gọi khi mở / quay lại tab:
--   với mỗi task gốc, tạo bản sao của lần lặp GẦN NHẤT đến hôm nay (bỏ qua các lần đã lỡ,
--   để không bị dồn cả chục bản sao quá hạn khi lâu không mở app).
--   Bản sao giữ tên, ghi chú, Area, Project, mức Quan trọng/Gấp, Năng lượng; ngày giờ được dời sang ngày lặp.
-- Chạy lại nhiều lần không lỗi.

alter table public.tasks add column if not exists repeat_rule text;
alter table public.tasks add column if not exists repeat_anchor timestamptz;
alter table public.tasks add column if not exists repeat_last_on date;
alter table public.tasks add column if not exists repeat_parent_id uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists repeat_on date;

alter table public.tasks drop constraint if exists tasks_repeat_rule_check;
alter table public.tasks add constraint tasks_repeat_rule_check
  check (repeat_rule is null or repeat_rule in ('day', 'weekday', 'week', '2weeks', 'month', '3months', '6months', 'year'));

create unique index if not exists tasks_repeat_occurrence_uniq
  on public.tasks (repeat_parent_id, repeat_on) where repeat_parent_id is not null;
create index if not exists tasks_repeat_rule_idx on public.tasks (user_id) where repeat_rule is not null;

-- Chọn / đổi / bỏ chu kỳ → đặt lại mốc tính
create or replace function public.task_repeat_anchor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.repeat_rule is null then
    new.repeat_anchor := null;
    new.repeat_last_on := null;
  -- (khôi phục task vừa xoá → giữ mốc cũ)
  elsif (tg_op = 'INSERT' and new.repeat_anchor is null)
     or (tg_op = 'UPDATE' and old.repeat_rule is distinct from new.repeat_rule) then
    new.repeat_anchor := coalesce(new.start_at, new.due_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_repeat_anchor on public.tasks;
create trigger trg_tasks_repeat_anchor
  before insert or update of repeat_rule on public.tasks
  for each row execute function public.task_repeat_anchor();

-- Tạo bản sao đến hạn cho người đang đăng nhập. Trả về số task vừa tạo.
--   p_tz         : múi giờ trình duyệt (vd 'Asia/Ho_Chi_Minh')
--   p_offset_min : độ lệch so với UTC tính bằng phút (vd 420 = UTC+7) — dùng khi database không biết tên múi giờ
drop function if exists public.generate_recurring_tasks(text);
create or replace function public.generate_recurring_tasks(p_tz text default 'UTC', p_offset_min integer default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t record;
  v_uid uuid := auth.uid();
  v_today date;
  v_anchor date;
  v_occ date;
  v_base date;
  v_k integer;
  v_m integer;
  v_d date;
  v_shift interval;
  v_rows integer;
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  -- Tính ngày theo múi giờ của người dùng. Không nhận ra tên múi giờ → dùng độ lệch phút → cuối cùng là UTC
  begin
    perform set_config('timezone', coalesce(nullif(p_tz, ''), 'UTC'), true);
  exception when others then
    if p_offset_min is not null then
      -- Kiểu POSIX: 'UTC-07:00' nghĩa là UTC+7
      perform set_config(
        'timezone',
        format('UTC%s%s:%s', case when p_offset_min >= 0 then '-' else '+' end,
               lpad((abs(p_offset_min) / 60)::text, 2, '0'), lpad((abs(p_offset_min) % 60)::text, 2, '0')),
        true);
    else
      perform set_config('timezone', 'UTC', true);
    end if;
  end;
  v_today := now()::date;

  for t in
    select * from public.tasks
    where user_id = v_uid and repeat_rule is not null
    for update
  loop
    v_anchor := coalesce(t.repeat_anchor, t.start_at, t.due_at, t.created_at)::date;
    continue when v_today <= v_anchor;
    v_occ := null;

    if t.repeat_rule in ('day', 'week', '2weeks') then
      v_k := (v_today - v_anchor) / case t.repeat_rule when 'day' then 1 when 'week' then 7 else 14 end;
      continue when v_k < 1;
      v_occ := v_anchor + v_k * case t.repeat_rule when 'day' then 1 when 'week' then 7 else 14 end;

    elsif t.repeat_rule = 'weekday' then
      v_d := v_today;
      while extract(isodow from v_d) > 5 loop
        v_d := v_d - 1;
      end loop;
      continue when v_d <= v_anchor;
      v_occ := v_d;

    else
      v_m := case t.repeat_rule when 'month' then 1 when '3months' then 3 when '6months' then 6 else 12 end;
      v_k := ((extract(year from v_today) - extract(year from v_anchor)) * 12
              + (extract(month from v_today) - extract(month from v_anchor)))::integer / v_m;
      if (v_anchor + make_interval(months => v_k * v_m))::date > v_today then
        v_k := v_k - 1;
      end if;
      continue when v_k < 1;
      v_occ := (v_anchor + make_interval(months => v_k * v_m))::date;
    end if;

    -- Đã tạo bản sao cho lần này (hoặc lần sau hơn) rồi → bỏ qua
    continue when t.repeat_last_on is not null and v_occ <= t.repeat_last_on;

    -- Dời ngày giờ của task gốc sang ngày lặp (giữ nguyên giờ và khoảng cách bắt đầu → hạn)
    v_base := coalesce(t.start_at, t.due_at)::date;
    v_shift := make_interval(days => v_occ - coalesce(v_base, v_occ));

    insert into public.tasks (
      user_id, task_name, notes, project_id, area_id, importance, urgency, task_type, energy_level,
      start_at, due_at, state, complete, position, repeat_parent_id, repeat_on
    ) values (
      t.user_id, t.task_name, t.notes, t.project_id, t.area_id, t.importance, t.urgency, t.task_type, t.energy_level,
      t.start_at + v_shift,
      case
        when t.due_at is not null then t.due_at + v_shift
        when t.start_at is null then (v_occ + 1)::timestamp - interval '1 second' -- task không có ngày → hạn cuối ngày lặp
        else null
      end,
      'not_started', false, t.position, t.id, v_occ
    )
    on conflict (repeat_parent_id, repeat_on) where repeat_parent_id is not null do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;

    update public.tasks set repeat_last_on = v_occ where id = t.id;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_recurring_tasks(text, integer) to authenticated;
