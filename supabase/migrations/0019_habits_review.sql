-- PARADoNext — Thói quen (Habit tracker) + Weekly Review
--
--   habits         : thói quen (tên, icon, Area, các ngày trong tuần cần làm)
--   habit_logs     : đã làm thói quen nào vào ngày nào (1 dòng = 1 lần tick)
--   weekly_reviews : sổ review mỗi tuần (đánh giá, điều tốt, cần cải thiện, trọng tâm tuần tới, ghi chú)
--                    + số liệu tuần đó (task xong, thời gian, % thói quen) lưu lại để xem về sau
--   Telegram (nếu đã chạy 0018): bản tóm tắt "Việc hôm nay" kèm danh sách thói quen hôm nay (✅/⬜)
--   Weekly Review KHÔNG liên quan tới bot (bản trước có nhắc review qua bot — file này tự gỡ nếu đã cài)
-- Chạy lại nhiều lần không lỗi.

-- ---------------------------------------------------------------------------
-- Thói quen
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  area_id uuid references public.areas(id) on delete set null,
  -- Ngày cần làm: 1 = Thứ Hai … 7 = Chủ Nhật
  days integer[] not null default '{1,2,3,4,5,6,7}',
  archived boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.habits drop constraint if exists habits_days_check;
alter table public.habits add constraint habits_days_check check (days <@ '{1,2,3,4,5,6,7}' and cardinality(days) > 0);
create index if not exists habits_user_idx on public.habits (user_id, archived, sort_order);

drop trigger if exists trg_habits_updated_at on public.habits;
create trigger trg_habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, day);

alter table public.habits enable row level security;
drop policy if exists "habits: owner full access" on public.habits;
create policy "habits: owner full access" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.habit_logs enable row level security;
drop policy if exists "habit_logs: owner full access" on public.habit_logs;
create policy "habit_logs: owner full access" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Weekly Review
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Thứ Hai của tuần được review
  week_start date not null,
  wins text,
  improve text,
  next_focus text,
  checked text[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- Tuần này thế nào (1–5 sao), ghi chú tự do, số liệu tuần (lưu lúc viết review)
alter table public.weekly_reviews add column if not exists rating smallint;
alter table public.weekly_reviews add column if not exists notes text;
alter table public.weekly_reviews add column if not exists stats jsonb;
alter table public.weekly_reviews drop constraint if exists weekly_reviews_rating_check;
alter table public.weekly_reviews add constraint weekly_reviews_rating_check check (rating is null or rating between 1 and 5);

drop trigger if exists trg_weekly_reviews_updated_at on public.weekly_reviews;
create trigger trg_weekly_reviews_updated_at before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

alter table public.weekly_reviews enable row level security;
drop policy if exists "weekly_reviews: owner full access" on public.weekly_reviews;
create policy "weekly_reviews: owner full access" on public.weekly_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Telegram (chỉ khi đã chạy 0018)
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.telegram_channels') is null then
    raise notice 'Chưa có bảng telegram_channels (migration 0018) — bỏ qua phần Telegram. Chạy 0018 rồi chạy lại file này.';
    return;
  end if;

  alter table public.telegram_channels add column if not exists include_habits boolean not null default true;
  -- Gỡ phần nhắc Weekly Review qua bot (nếu đã cài từ bản trước)
  alter table public.telegram_channels drop constraint if exists telegram_channels_review_day_check;
  alter table public.telegram_channels drop column if exists review_day;
  alter table public.telegram_channels drop column if exists review_time;
end;
$do$;

-- Tóm tắt Telegram: thêm phần thói quen hôm nay
create or replace function public.build_task_digest(p_user uuid, p_scope text, p_today date)
returns table (message text, task_count integer)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := case when p_scope = 'tomorrow' then p_today + 1 else p_today end;
  v_wd text := (array['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'])[extract(isodow from v_day)::int];
  v_main text;
  v_main_n integer;
  v_over text;
  v_over_n integer := 0;
  v_msg text;
  v_hab text;
  v_hab_n integer := 0;
  v_hab_done integer := 0;
begin
  select string_agg(line, E'\n'), count(*)::int into v_main, v_main_n from (
    select public.tg_task_line(t, v_day) as line
    from public.tasks t
    where t.user_id = p_user and not t.complete
      and (t.due_at::date = v_day or t.start_at::date = v_day)
    order by coalesce(case when t.start_at::date = v_day then t.start_at end, t.due_at), t.importance desc, t.created_at
    limit 25
  ) x;

  if p_scope <> 'tomorrow' then
    select string_agg(line, E'\n'), count(*)::int into v_over, v_over_n from (
      select public.tg_task_line(t, v_day, true) as line
      from public.tasks t
      where t.user_id = p_user and not t.complete and t.due_at is not null and t.due_at::date < v_day
      order by t.due_at desc
      limit 10
    ) x;
  end if;

  v_msg := case when p_scope = 'tomorrow' then '🌙 <b>Việc ngày mai</b> — ' else '☀️ <b>Việc hôm nay</b> — ' end
           || v_wd || ' ' || to_char(v_day, 'DD/MM');
  if coalesce(v_over_n, 0) > 0 then
    v_msg := v_msg || E'\n\n⚠️ <b>Quá hạn</b> (' || v_over_n || E')\n' || v_over;
  end if;
  if coalesce(v_main_n, 0) > 0 then
    v_msg := v_msg || E'\n\n📌 <b>' || case when p_scope = 'tomorrow' then 'Ngày mai' else 'Hôm nay' end
             || '</b> (' || v_main_n || E')\n' || v_main;
  end if;
  if coalesce(v_over_n, 0) + coalesce(v_main_n, 0) = 0 then
    v_msg := v_msg || E'\n\n✅ Không có task nào ' || case when p_scope = 'tomorrow' then 'cho ngày mai.' else 'tới hạn hôm nay.' end;
  end if;
  -- Thói quen hôm nay (0019) — nếu bật "Kèm thói quen" trong trang Channel
  if p_scope <> 'tomorrow' and coalesce((select include_habits from public.telegram_channels where user_id = p_user), true) then
    select string_agg(case when l.day is not null then '✅ ' else '⬜ ' end || coalesce(h.icon || ' ', '') || public.tg_escape(h.name), E'\n' order by h.sort_order, h.created_at),
           count(*)::int, count(l.day)::int
      into v_hab, v_hab_n, v_hab_done
    from public.habits h
    left join public.habit_logs l on l.habit_id = h.id and l.day = v_day
    where h.user_id = p_user and not h.archived and extract(isodow from v_day)::int = any (h.days);
    if coalesce(v_hab_n, 0) > 0 then
      v_msg := v_msg || E'\n\n🔁 <b>Thói quen</b> (' || v_hab_done || '/' || v_hab_n || E')\n' || v_hab;
    end if;
  end if;
  return query select v_msg, coalesce(v_over_n, 0) + coalesce(v_main_n, 0);
end;
$$;

revoke all on function public.build_task_digest(uuid, text, date) from public, anon, authenticated;

-- Gỡ lịch + hàm nhắc Weekly Review qua bot (nếu đã cài từ bản trước)
drop function if exists public.push_review_reminders();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.unschedule(jobid) from cron.job where jobname = 'paradonext-review'$c$;
  end if;
end;
$$;
