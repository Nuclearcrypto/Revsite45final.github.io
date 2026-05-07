-- Rev-N-Rip Bounty Decision Notes
-- Run this in Supabase SQL Editor.
-- Adds an admin_response field so denied bounties can show the user why they were denied.

alter table public.user_bounties
add column if not exists admin_response text;

-- Optional check:
select id, title, status, admin_response
from public.user_bounties
order by created_at desc
limit 20;
