-- 能躺了吗阶段 1 数据库 schema
-- 目标数据库：PostgreSQL

create table users (
  id text primary key,
  identifier text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table sessions (
  id text primary key,
  user_id text not null references users(id),
  created_at timestamptz not null default now()
);

create table auth_codes (
  id text primary key,
  identifier text not null,
  code text not null,
  created_at timestamptz not null default now()
);

create table plans (
  id text primary key,
  user_id text not null references users(id),
  title text not null default '我的家庭规划',
  liquid_assets numeric not null default 0,
  locked_assets numeric not null default 0,
  liabilities numeric not null default 0,
  annual_income numeric not null default 0,
  annual_expense numeric not null default 0,
  income_growth_rate numeric not null default 0,
  expense_growth_rate numeric not null default 0,
  work_years numeric not null default 20,
  return_rate numeric not null default 4,
  inflation_rate numeric not null default 3,
  discount_rate numeric not null default 3,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table goals (
  id text primary key,
  plan_id text not null references plans(id) on delete cascade,
  name text not null,
  kind text not null,
  priority text not null,
  frequency text,
  amount numeric not null default 0,
  year numeric,
  start_year numeric,
  end_year numeric,
  goal_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_reports (
  id text primary key,
  plan_id text not null references plans(id) on delete cascade,
  metrics_json jsonb not null,
  ai_report_json jsonb not null,
  created_at timestamptz not null default now()
);

create table ai_conversations (
  id text primary key,
  user_id text not null references users(id),
  plan_id text references plans(id),
  title text not null default '继续问 AI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_messages (
  id text primary key,
  conversation_id text not null references ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  structured_json jsonb,
  model_name text,
  model_request_id text,
  created_at timestamptz not null default now()
);

create table model_call_logs (
  id text primary key,
  user_id text references users(id),
  provider text not null,
  model_name text not null,
  request_type text not null,
  prompt_tokens integer,
  completion_tokens integer,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table feedback (
  id text primary key,
  user_id text references users(id),
  type text not null,
  content text not null,
  contact text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
