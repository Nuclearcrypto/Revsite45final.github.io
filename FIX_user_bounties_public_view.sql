-- Rev-N-Rip fix for error:
-- ERROR: cannot change name of view column "title" to "user_id"
--
-- Run this in Supabase SQL Editor, then rerun supabase-chat-setup.sql if needed.

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
