-- Rev-N-Rip Supabase Setup
-- Run this in Supabase SQL Editor.
-- This creates profiles, user-submitted bounties, RLS policies, and a public approved-bounties view.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_bounties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text unique not null,
  category text,
  wanted_details text,
  offer_type text,
  condition_wanted text,
  budget_range text,
  contact_preference text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_bounties_updated_at on public.user_bounties;
create trigger set_user_bounties_updated_at
before update on public.user_bounties
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_bounties enable row level security;

-- Profiles policies
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile except admin" on public.profiles;
create policy "Users can update their own profile except admin"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Helper admin function
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and is_admin = true
  );
$$;

-- User bounty policies
drop policy if exists "Users can read their own bounties" on public.user_bounties;
create policy "Users can read their own bounties"
on public.user_bounties for select
using (auth.uid() = user_id or public.is_admin() or status = 'approved');

drop policy if exists "Users can insert their own bounties" on public.user_bounties;
create policy "Users can insert their own bounties"
on public.user_bounties for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own pending bounties" on public.user_bounties;
create policy "Users can update own pending bounties"
on public.user_bounties for update
using (auth.uid() = user_id and status = 'pending')
with check (auth.uid() = user_id);

drop policy if exists "Admins can update all bounties" on public.user_bounties;
create policy "Admins can update all bounties"
on public.user_bounties for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete bounties" on public.user_bounties;
create policy "Admins can delete bounties"
on public.user_bounties for delete
using (public.is_admin());

-- Public approved bounty view
create or replace view public.user_bounties_public as
select
  b.id,
  b.title,
  b.slug,
  b.category,
  b.wanted_details,
  b.offer_type,
  b.condition_wanted,
  b.budget_range,
  b.status,
  b.created_at,
  p.username
from public.user_bounties b
left join public.profiles p on p.id = b.user_id
where b.status = 'approved';

grant select on public.user_bounties_public to anon, authenticated;

-- After creating your own account, make yourself admin by replacing the email below:
-- update public.profiles set is_admin = true where email = 'YOUR_EMAIL_HERE';
