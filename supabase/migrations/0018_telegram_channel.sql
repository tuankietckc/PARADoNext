-- PARADoNext — Channel: bot Telegram đẩy thông báo task
--
--   Bot CHỈ gửi thông báo (không nhận lệnh). Kết nối bằng token của bot (tạo với @BotFather) + chat id.
--   Các loại thông báo (tự đặt trong trang Channel):
--     • Tóm tắt theo giờ  : vd 07:30 "Việc hôm nay", 21:00 "Việc ngày mai" — chọn ngày trong tuần
--     • Nhắc trước hạn    : task có giờ hạn cụ thể → nhắc trước N phút
--     • Tới giờ bắt đầu   : task có giờ bắt đầu → nhắc đúng giờ
--     • Nhắc lúc          : giờ nhắc riêng từng task (tasks.remind_at — trường "Nhắc lúc" trong trang task)
--   Supabase gửi mỗi phút bằng pg_cron + pg_net (gọi thẳng Telegram API) — không cần server riêng.
--
-- CẦN: 0017 đã chạy; bật pg_cron (Integrations → Cron) và pg_net (Database → Extensions).
--      Chưa bật thì migration vẫn chạy được, chỉ chưa tự gửi (chạy lại file này sau khi bật).
-- Lưu ý bảo mật: token bot lưu trong bảng có RLS — chỉ chính bạn đọc được.
-- Chạy lại nhiều lần không lỗi.

do $$
begin
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'Chưa bật được pg_net (%). Bật ở Supabase Dashboard → Database → Extensions rồi chạy lại file này.', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_channels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bot_token text not null,
  bot_username text,
  chat_id text,
  chat_title text,
  enabled boolean not null default true,
  -- [{"time":"07:30","scope":"today"}, {"time":"21:00","scope":"tomorrow"}]
  digests jsonb not null default '[{"time":"07:30","scope":"today"}]'::jsonb,
  -- Ngày gửi tóm tắt: 1 = Thứ Hai … 7 = Chủ Nhật
  digest_days integer[] not null default '{1,2,3,4,5,6,7}',
  -- Bỏ qua bản tóm tắt khi không có task nào
  skip_empty boolean not null default false,
  -- Nhắc trước hạn bao nhiêu phút (null = tắt)
  remind_before_due_min integer default 15,
  remind_at_start boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_channels drop constraint if exists telegram_channels_digests_check;
alter table public.telegram_channels add constraint telegram_channels_digests_check check (jsonb_typeof(digests) = 'array');
alter table public.telegram_channels drop constraint if exists telegram_channels_remind_check;
alter table public.telegram_channels add constraint telegram_channels_remind_check
  check (remind_before_due_min is null or remind_before_due_min between 0 and 1440);

drop trigger if exists trg_telegram_channels_updated_at on public.telegram_channels;
create trigger trg_telegram_channels_updated_at before update on public.telegram_channels
  for each row execute function public.set_updated_at();

alter table public.telegram_channels enable row level security;
drop policy if exists "telegram_channels: owner full access" on public.telegram_channels;
create policy "telegram_channels: owner full access" on public.telegram_channels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nhật ký đã gửi (chống gửi trùng + xem lại trong trang Channel)
create table if not exists public.notification_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  kind text not null check (kind in ('digest', 'due', 'start', 'remind', 'test')),
  dedup_key text not null,
  message text,
  request_id bigint,
  created_at timestamptz not null default now(),
  unique (user_id, kind, dedup_key)
);
create index if not exists notification_log_user_created_idx on public.notification_log (user_id, created_at desc);

alter table public.notification_log enable row level security;
drop policy if exists "notification_log: owner read" on public.notification_log;
create policy "notification_log: owner read" on public.notification_log
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Hàm tiện ích
-- ---------------------------------------------------------------------------
create or replace function public.tg_escape(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

-- Gửi 1 tin nhắn Telegram (bất đồng bộ qua pg_net). Trả về id request để xem kết quả.
create or replace function public.telegram_send(p_token text, p_chat text, p_text text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    into v_id
    using 'https://api.telegram.org/bot' || p_token || '/sendMessage',
          jsonb_build_object('chat_id', p_chat, 'text', left(p_text, 4000), 'parse_mode', 'HTML',
                             'disable_web_page_preview', true),
          '{"Content-Type": "application/json"}'::jsonb;
  return v_id;
end;
$$;

-- 1 dòng mô tả task trong tin nhắn
create or replace function public.tg_task_line(p_task public.tasks, p_day date, p_show_date boolean default false)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_time text := '';
  v_project text;
begin
  if p_task.start_at is not null and p_task.start_at::date = p_day and to_char(p_task.start_at, 'HH24:MI') <> '00:00' then
    v_time := to_char(p_task.start_at, 'HH24:MI') || ' ';
  elsif p_task.due_at is not null and p_task.due_at::date = p_day and to_char(p_task.due_at, 'HH24:MI') not in ('23:59', '00:00') then
    v_time := '⏰' || to_char(p_task.due_at, 'HH24:MI') || ' ';
  end if;
  select name into v_project from public.projects where id = p_task.project_id;
  return '• ' || v_time || public.tg_escape(p_task.task_name)
    || case when p_task.importance::text = 'high' then ' ❗' else '' end
    || case when p_task.state::text = 'in_progress' then ' ▶️' else '' end
    || case when p_show_date and p_task.due_at is not null then ' <i>— hạn ' || to_char(p_task.due_at, 'DD/MM') || '</i>' else '' end
    || case when v_project is not null then ' <i>· ' || public.tg_escape(v_project) || '</i>' else '' end;
end;
$$;

-- Bản tóm tắt: scope 'today' (quá hạn + hôm nay) hoặc 'tomorrow'. Gọi khi đã đặt múi giờ.
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
  return query select v_msg, coalesce(v_over_n, 0) + coalesce(v_main_n, 0);
end;
$$;

-- Ghi nhật ký trước (chống trùng), gửi sau. Trả về true nếu đã gửi.
create or replace function public.tg_log_and_send(
  p_user uuid, p_token text, p_chat text, p_kind text, p_key text, p_task uuid, p_text text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint;
begin
  insert into public.notification_log (user_id, task_id, kind, dedup_key, message)
  values (p_user, p_task, p_kind, p_key, p_text)
  on conflict (user_id, kind, dedup_key) do nothing
  returning id into v_log;
  if v_log is null then
    return false;
  end if;
  update public.notification_log
    set request_id = public.telegram_send(p_token, p_chat, p_text)
    where id = v_log;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- pg_cron gọi mỗi phút: gửi mọi thông báo đến hạn
-- ---------------------------------------------------------------------------
create or replace function public.push_task_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  d record;
  t public.tasks;
  v_today date;
  v_at timestamp;
  v_sent integer;
  v_total integer := 0;
  v_digest record;
  v_left integer;
  v_extra text;
begin
  for c in
    select ch.*, public.resolve_tz(s.timezone, s.utc_offset_min) as tz
    from public.telegram_channels ch
    left join public.user_settings s on s.user_id = ch.user_id
    where ch.enabled and ch.chat_id is not null and ch.bot_token <> ''
  loop
    begin
      perform set_config('timezone', c.tz, true);
      v_today := now()::date;
      v_sent := 0;

      -- 1. Tóm tắt theo giờ (gửi trong 30 phút sau giờ đặt, mỗi giờ 1 lần/ngày)
      if extract(isodow from v_today)::int = any (c.digest_days) then
        for d in select * from jsonb_to_recordset(c.digests) as x("time" text, scope text) loop
          begin
            v_at := v_today + d."time"::time;
          exception when others then
            continue;
          end;
          continue when not (now()::timestamp >= v_at and now()::timestamp < v_at + interval '30 minutes');
          select * into v_digest from public.build_task_digest(c.user_id, coalesce(d.scope, 'today'), v_today);
          continue when c.skip_empty and v_digest.task_count = 0;
          if public.tg_log_and_send(c.user_id, c.bot_token, c.chat_id, 'digest', v_today::text || ' ' || d."time" || ' ' || coalesce(d.scope, 'today'), null, v_digest.message) then
            v_sent := v_sent + 1;
          end if;
        end loop;
      end if;

      -- 2. Nhắc trước hạn (task có giờ hạn cụ thể, không phải "cả ngày")
      if c.remind_before_due_min is not null then
        for t in
          select * from public.tasks
          where user_id = c.user_id and not complete and due_at is not null
            and to_char(due_at, 'HH24:MI') not in ('23:59', '00:00')
            and due_at - make_interval(mins => c.remind_before_due_min) <= now()
            and due_at > now() - interval '10 minutes'
          order by due_at
          limit 10
        loop
          exit when v_sent >= 15;
          v_left := ceil(extract(epoch from (t.due_at - now())) / 60)::int;
          if public.tg_log_and_send(
            c.user_id, c.bot_token, c.chat_id, 'due', t.id::text || '@' || t.due_at::text, t.id,
            '⏰ <b>' || case when v_left > 0 then 'Sắp tới hạn</b> — còn ' || v_left || ' phút (' else 'Tới hạn</b> (' end
              || to_char(t.due_at, 'HH24:MI') || E')\n' || public.tg_task_line(t, t.due_at::date)
          ) then
            v_sent := v_sent + 1;
          end if;
        end loop;
      end if;

      -- 3. Tới giờ bắt đầu (bỏ qua task vừa tạo với "bắt đầu = bây giờ")
      if c.remind_at_start then
        for t in
          select * from public.tasks
          where user_id = c.user_id and not complete and state::text <> 'in_progress' and start_at is not null
            and to_char(start_at, 'HH24:MI') <> '00:00'
            and start_at <= now() and start_at > now() - interval '10 minutes'
            and start_at > created_at + interval '1 minute'
          order by start_at
          limit 10
        loop
          exit when v_sent >= 15;
          if public.tg_log_and_send(
            c.user_id, c.bot_token, c.chat_id, 'start', t.id::text || '@' || t.start_at::text, t.id,
            '▶️ <b>Tới giờ bắt đầu</b> (' || to_char(t.start_at, 'HH24:MI') || E')\n' || public.tg_task_line(t, t.start_at::date)
          ) then
            v_sent := v_sent + 1;
          end if;
        end loop;
      end if;

      -- 4. "Nhắc lúc" riêng từng task
      for t in
        select * from public.tasks
        where user_id = c.user_id and not complete and remind_at is not null
          and remind_at <= now() and remind_at > now() - interval '1 day'
        order by remind_at
        limit 10
      loop
        exit when v_sent >= 15;
        v_extra := case when t.due_at is not null then E'\n<i>Hạn: ' || to_char(t.due_at, 'HH24:MI DD/MM') || '</i>' else '' end;
        if public.tg_log_and_send(
          c.user_id, c.bot_token, c.chat_id, 'remind', t.id::text || '@' || t.remind_at::text, t.id,
          E'🔔 <b>Nhắc việc</b>\n' || public.tg_task_line(t, coalesce(t.due_at, t.remind_at)::date) || v_extra
        ) then
          v_sent := v_sent + 1;
        end if;
      end loop;

      v_total := v_total + v_sent;
    exception when others then
      raise warning 'push_task_notifications: user % lỗi: %', c.user_id, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hàm cho app (trang Channel)
-- ---------------------------------------------------------------------------
-- Gửi ngay bản tóm tắt qua đường server (kiểm tra pg_net + nội dung)
create or replace function public.telegram_send_digest_now(p_scope text default 'today')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.telegram_channels;
  v_tz text;
  v_digest record;
begin
  select * into c from public.telegram_channels where user_id = auth.uid();
  if c.user_id is null or c.chat_id is null then
    raise exception 'Chưa kết nối bot Telegram.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Supabase chưa bật pg_net — bật ở Database → Extensions rồi chạy lại migration 0018.';
  end if;
  select public.resolve_tz(s.timezone, s.utc_offset_min) into v_tz from public.user_settings s where s.user_id = c.user_id;
  perform set_config('timezone', coalesce(v_tz, 'UTC'), true);
  select * into v_digest from public.build_task_digest(c.user_id, coalesce(p_scope, 'today'), now()::date);
  return public.tg_log_and_send(c.user_id, c.bot_token, c.chat_id, 'test', clock_timestamp()::text, null, v_digest.message);
end;
$$;

-- 20 tin gần nhất + kết quả từ Telegram (mã 200 = đã tới; pg_net giữ kết quả 6 giờ)
create or replace function public.telegram_recent_log()
returns table (created_at timestamptz, kind text, message text, status_code integer, error text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    return query execute
      'select l.created_at, l.kind, l.message, r.status_code,
              coalesce(r.error_msg, case when r.status_code >= 400 then r.content end)
       from public.notification_log l
       left join net._http_response r on r.id = l.request_id
       where l.user_id = $1
       order by l.created_at desc
       limit 20'
      using auth.uid();
  exception when undefined_table or invalid_schema_name then
    return query
      select l.created_at, l.kind, l.message, null::integer, null::text
      from public.notification_log l
      where l.user_id = auth.uid()
      order by l.created_at desc
      limit 20;
  end;
end;
$$;

-- Trạng thái server: đã bật pg_cron / pg_net chưa, lịch đã chạy chưa
create or replace function public.telegram_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
  v_net boolean := exists (select 1 from pg_extension where extname = 'pg_net');
  v_push boolean := false;
  v_recurring boolean := false;
begin
  if v_cron then
    execute 'select exists (select 1 from cron.job where jobname = ''paradonext-telegram'' and active)' into v_push;
    execute 'select exists (select 1 from cron.job where jobname = ''paradonext-recurring'' and active)' into v_recurring;
  end if;
  return jsonb_build_object('cron', v_cron, 'net', v_net, 'push_job', v_push, 'recurring_job', v_recurring);
end;
$$;

-- Dọn nhật ký cũ (chạy mỗi ngày)
create or replace function public.cron_cleanup_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_log where created_at < now() - interval '30 days';
  begin
    execute 'delete from cron.job_run_details where end_time < now() - interval ''3 days''';
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.telegram_send(text, text, text) from public, anon, authenticated;
revoke all on function public.tg_log_and_send(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.push_task_notifications() from public, anon, authenticated;
revoke all on function public.cron_cleanup_notifications() from public, anon, authenticated;
revoke all on function public.build_task_digest(uuid, text, date) from public, anon, authenticated;
grant execute on function public.telegram_send_digest_now(text) to authenticated;
grant execute on function public.telegram_recent_log() to authenticated;
grant execute on function public.telegram_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Lên lịch: gửi mỗi phút · dọn nhật ký mỗi ngày
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Chưa bật được pg_cron (%). Bật ở Supabase Dashboard → Integrations → Cron rồi chạy lại file này.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.schedule('paradonext-telegram', '* * * * *', 'select public.push_task_notifications()')$c$;
    execute $c$select cron.schedule('paradonext-cleanup', '17 20 * * *', 'select public.cron_cleanup_notifications()')$c$;
    raise notice 'Đã lên lịch paradonext-telegram (mỗi phút) và paradonext-cleanup (mỗi ngày).';
  end if;
end;
$$;
