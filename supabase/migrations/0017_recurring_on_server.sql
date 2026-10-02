-- PARADoNext — Task lặp lại chạy trên server (pg_cron) + lưu múi giờ người dùng
--
--   Trước (0016): bản sao task lặp chỉ được tạo khi mở app.
--   Giờ: Supabase tự chạy mỗi 10 phút (pg_cron) → bản sao có đúng giờ kể cả khi không mở app.
--   App vẫn gọi hàm khi mở (phòng khi chưa bật pg_cron).
--
--   user_settings : múi giờ của người dùng (app tự lưu khi mở) — dùng cho task lặp và thông báo Telegram
--   tasks.remind_at: "Nhắc lúc" — giờ bot Telegram nhắc riêng cho task (dùng ở 0018)
--
-- CẦN: bật pg_cron — Supabase Dashboard → Integrations → Cron (hoặc Database → Extensions → pg_cron).
--      Chưa bật thì migration vẫn chạy được, chỉ bỏ qua bước lên lịch (chạy lại file này sau khi bật).
-- Chạy lại nhiều lần không lỗi.

-- ---------------------------------------------------------------------------
-- Múi giờ người dùng
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  utc_offset_min integer,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "user_settings: owner full access" on public.user_settings;
create policy "user_settings: owner full access" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tasks add column if not exists remind_at timestamptz;

-- Tên múi giờ database biết → dùng; không thì dựng từ độ lệch phút (kiểu POSIX 'UTC-07:00' = UTC+7); cuối cùng UTC
create or replace function public.resolve_tz(p_tz text, p_offset_min integer)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz
    when p_offset_min is not null then format(
      'UTC%s%s:%s',
      case when p_offset_min >= 0 then '-' else '+' end,
      lpad((abs(p_offset_min) / 60)::text, 2, '0'),
      lpad((abs(p_offset_min) % 60)::text, 2, '0'))
    else 'UTC'
  end
$$;

-- ---------------------------------------------------------------------------
-- Lõi: tạo bản sao đến hạn cho 1 người dùng (chỉ server gọi)
-- ---------------------------------------------------------------------------
create or replace function public.generate_recurring_for(p_user uuid, p_tz text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
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
  if p_user is null then
    return 0;
  end if;
  perform set_config('timezone', coalesce(nullif(p_tz, ''), 'UTC'), true);
  v_today := now()::date;

  for t in
    select * from public.tasks
    where user_id = p_user and repeat_rule is not null
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

    continue when t.repeat_last_on is not null and v_occ <= t.repeat_last_on;

    v_base := coalesce(t.start_at, t.due_at)::date;
    v_shift := make_interval(days => v_occ - coalesce(v_base, v_occ));

    insert into public.tasks (
      user_id, task_name, notes, project_id, area_id, importance, urgency, task_type, energy_level,
      start_at, due_at, remind_at, state, complete, position, repeat_parent_id, repeat_on
    ) values (
      t.user_id, t.task_name, t.notes, t.project_id, t.area_id, t.importance, t.urgency, t.task_type, t.energy_level,
      t.start_at + v_shift,
      case
        when t.due_at is not null then t.due_at + v_shift
        when t.start_at is null then (v_occ + 1)::timestamp - interval '1 second'
        else null
      end,
      t.remind_at + make_interval(days => v_occ - coalesce(v_base, t.remind_at::date, v_occ)),
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

-- App gọi (khi mở / quay lại tab): lưu múi giờ rồi tạo bản sao cho chính người đang đăng nhập
-- (security definer để gọi được hàm lõi; chỉ làm việc với auth.uid() nên an toàn)
create or replace function public.generate_recurring_tasks(p_tz text default 'UTC', p_offset_min integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 0;
  end if;
  insert into public.user_settings (user_id, timezone, utc_offset_min, updated_at)
  values (v_uid, coalesce(nullif(p_tz, ''), 'UTC'), p_offset_min, now())
  on conflict (user_id) do update
    set timezone = excluded.timezone, utc_offset_min = excluded.utc_offset_min, updated_at = now()
    where public.user_settings.timezone is distinct from excluded.timezone
       or public.user_settings.utc_offset_min is distinct from excluded.utc_offset_min;
  return public.generate_recurring_for(v_uid, public.resolve_tz(p_tz, p_offset_min));
end;
$$;

-- pg_cron gọi: chạy cho mọi người dùng có task lặp
create or replace function public.cron_generate_recurring()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  v_total integer := 0;
begin
  for u in
    select distinct t.user_id, s.timezone, s.utc_offset_min
    from public.tasks t
    left join public.user_settings s on s.user_id = t.user_id
    where t.repeat_rule is not null
  loop
    v_total := v_total + public.generate_recurring_for(u.user_id, public.resolve_tz(u.timezone, u.utc_offset_min));
  end loop;
  return v_total;
end;
$$;

-- Hàm lõi / hàm cron: không cho app gọi thẳng (tránh tạo task cho người khác)
revoke all on function public.generate_recurring_for(uuid, text) from public, anon, authenticated;
revoke all on function public.cron_generate_recurring() from public, anon, authenticated;
grant execute on function public.generate_recurring_tasks(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Lên lịch: mỗi 10 phút
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Chưa bật được pg_cron (%). Bật ở Supabase Dashboard → Integrations → Cron rồi chạy lại file này.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$select cron.schedule('paradonext-recurring', '*/10 * * * *', 'select public.cron_generate_recurring()')$cron$;
    raise notice 'Đã lên lịch paradonext-recurring (mỗi 10 phút).';
  end if;
end;
$$;
