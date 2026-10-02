-- PARADoNext — Initial schema (xem README mục 8 để biết đầy đủ ngữ nghĩa field)
-- Chạy file này trong Supabase SQL Editor (Dashboard > SQL Editor > New query),
-- hoặc qua Supabase CLI: supabase db push (khi đã `supabase link` project).

-- ==========================================================
-- EXTENSIONS
-- ==========================================================
create extension if not exists "uuid-ossp";

-- ==========================================================
-- ENUM TYPES
-- ==========================================================
create type importance_level as enum ('low', 'medium', 'high');
create type urgency_level as enum ('low', 'medium', 'high');
create type energy_level as enum ('low', 'medium', 'high');
create type task_state as enum ('not_started', 'in_progress', 'done');
create type task_type as enum ('task', 'habit');
create type view_type as enum ('table');

-- ==========================================================
-- AREAS
-- ==========================================================
create table areas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- PROJECTS
-- ==========================================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid references areas(id) on delete set null,
  name text not null,
  is_favorite boolean not null default false,
  completed boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- RESOURCES
-- ==========================================================
create table resources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  title text not null,
  content text,
  url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- TASKS  (nguồn dữ liệu thật duy nhất — xem README mục 8.1)
-- ==========================================================
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  area_id uuid references areas(id) on delete set null,

  task_name text not null,
  notes text,

  start_at timestamptz,
  due_at timestamptz,

  importance importance_level not null default 'medium',
  urgency urgency_level not null default 'medium',
  energy_level energy_level not null default 'medium',

  estimated_minutes int,
  actual_minutes int,

  state task_state not null default 'not_started',
  task_type task_type not null default 'task',

  complete boolean not null default false,
  moved_the_needle boolean,

  -- Habit-specific (chỉ dùng khi task_type = 'habit', xem README Phase 2)
  habit_frequency text,        -- vd: 'daily', 'weekly', rrule đơn giản

  position double precision,   -- dùng cho kéo-thả sắp thứ tự thủ công (Phase 2)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_user_id on tasks(user_id);
create index idx_tasks_due_at on tasks(due_at);
create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_area_id on tasks(area_id);
create index idx_tasks_complete on tasks(complete);

-- ==========================================================
-- INBOX ITEMS (chưa qua xử lý AI / chưa phân loại)
-- ==========================================================
create table inbox_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- SAVED VIEWS (xem README mục 8.3 — Filter DSL)
-- ==========================================================
create table saved_views (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  filters jsonb not null default '[]'::jsonb,
  sorts jsonb not null default '[]'::jsonb,
  group_by text,
  visible_columns jsonb not null default '[]'::jsonb,
  view_type view_type not null default 'table',
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- updated_at auto-update trigger (dùng chung cho các bảng có updated_at)
-- ==========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_areas_updated_at before update on areas
  for each row execute function set_updated_at();
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger trg_resources_updated_at before update on resources
  for each row execute function set_updated_at();
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger trg_saved_views_updated_at before update on saved_views
  for each row execute function set_updated_at();

-- ==========================================================
-- ROW LEVEL SECURITY — mỗi user chỉ thấy/đổi được dữ liệu của chính mình
-- ==========================================================
alter table areas enable row level security;
alter table projects enable row level security;
alter table resources enable row level security;
alter table tasks enable row level security;
alter table inbox_items enable row level security;
alter table saved_views enable row level security;

create policy "areas: owner full access" on areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "projects: owner full access" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "resources: owner full access" on resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks: owner full access" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inbox_items: owner full access" on inbox_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_views: owner full access" on saved_views
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
