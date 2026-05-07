-- Rev-N-Rip bounty submission diagnostic/fix
-- Run this if dashboard.html gets stuck or shows an RLS/profile insert error.
-- Safe to rerun.

-- 1. Confirm tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
and table_name in ('profiles','user_bounties');

-- 2. Confirm your logged-in profile exists
select id, email, username, is_admin
from public.profiles
order by created_at desc;

-- 3. Ensure RLS is on
alter table public.user_bounties enable row level security;

-- 4. Recreate user bounty insert/read policies
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

-- 5. If the public.is_admin() helper is missing, recreate it.
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
