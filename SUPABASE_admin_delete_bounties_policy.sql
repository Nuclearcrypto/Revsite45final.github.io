-- Rev-N-Rip Admin Delete Bounties Policy
-- Run this in Supabase SQL Editor if permanent delete fails from admin.html.

drop policy if exists "Admins can delete bounties" on public.user_bounties;

create policy "Admins can delete bounties"
on public.user_bounties for delete
using (public.is_admin());
