-- Rev-N-Rip Internal Chat System Add-On
-- Run this after supabase-setup.sql.
-- Adds conversations, members, messages, reports, RLS policies, and realtime support.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  bounty_slug text,
  bounty_title text,
  status text not null default 'open' check (status in ('open','closed','reported')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

create or replace function public.touch_conversation_last_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists touch_conversation_last_message_trigger on public.messages;
create trigger touch_conversation_last_message_trigger
after insert on public.messages
for each row execute function public.touch_conversation_last_message();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;

create or replace function public.is_conversation_member(convo uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = convo
    and user_id = auth.uid()
  );
$$;

-- Conversations
drop policy if exists "Conversation members can read conversations" on public.conversations;
create policy "Conversation members can read conversations"
on public.conversations for select
using (public.is_conversation_member(id) or public.is_admin());

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
on public.conversations for insert
with check (auth.uid() = created_by);

drop policy if exists "Conversation members can update conversations" on public.conversations;
create policy "Conversation members can update conversations"
on public.conversations for update
using (public.is_conversation_member(id) or public.is_admin())
with check (public.is_conversation_member(id) or public.is_admin());

-- Members
drop policy if exists "Members can read membership" on public.conversation_members;
create policy "Members can read membership"
on public.conversation_members for select
using (user_id = auth.uid() or public.is_conversation_member(conversation_id) or public.is_admin());

drop policy if exists "Conversation creator can add members" on public.conversation_members;
create policy "Conversation creator can add members"
on public.conversation_members for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.conversations
    where id = conversation_id
    and created_by = auth.uid()
  )
);

drop policy if exists "Members can update own read time" on public.conversation_members;
create policy "Members can update own read time"
on public.conversation_members for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Messages
drop policy if exists "Conversation members can read messages" on public.messages;
create policy "Conversation members can read messages"
on public.messages for select
using (public.is_conversation_member(conversation_id) or public.is_admin());

drop policy if exists "Conversation members can send messages" on public.messages;
create policy "Conversation members can send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

drop policy if exists "Admins can update messages" on public.messages;
create policy "Admins can update messages"
on public.messages for update
using (public.is_admin())
with check (public.is_admin());

-- Reports
drop policy if exists "Users can create message reports" on public.message_reports;
create policy "Users can create message reports"
on public.message_reports for insert
with check (
  reporter_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

drop policy if exists "Admins can read message reports" on public.message_reports;
create policy "Admins can read message reports"
on public.message_reports for select
using (public.is_admin());

drop policy if exists "Admins can update message reports" on public.message_reports;
create policy "Admins can update message reports"
on public.message_reports for update
using (public.is_admin())
with check (public.is_admin());

-- Let Realtime send updates from these tables.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversations;

-- Update public bounty view to expose user_id so messages can route to bounty owners.
-- We DROP first because Postgres will not allow CREATE OR REPLACE VIEW to change column order/names.
drop view if exists public.user_bounties_public;

create view public.user_bounties_public as
select
  b.id,
  b.user_id,
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
