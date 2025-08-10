create extension if not exists pgcrypto;

create table if not exists instructions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_public boolean default false,
  created_by uuid references auth.users(id) on delete cascade,
  category text,
  tags text[],
  file_url text,
  file_name text,
  instruction_type text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  instruction_id uuid references instructions(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, instruction_id)
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration integer,
  video_url text,
  thumbnail_url text,
  created_by uuid references auth.users(id) on delete cascade,
  instruction_id uuid references instructions(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  instruction_id uuid references instructions(id) on delete cascade,
  current_step integer default 0,
  completed_steps integer[] default '{}',
  verification_data jsonb,
  started_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, instruction_id)
);

alter table instructions enable row level security;
alter table bookmarks enable row level security;
alter table lessons enable row level security;
alter table user_progress enable row level security;

create policy "Public instructions are viewable by everyone"
  on instructions for select
  using (is_public = true);

create policy "Users can view their own instructions"
  on instructions for select
  using (auth.uid() = created_by);

create policy "Users can create their own instructions"
  on instructions for insert
  with check (auth.uid() = created_by);
