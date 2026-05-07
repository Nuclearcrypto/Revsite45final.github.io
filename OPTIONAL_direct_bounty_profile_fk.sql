-- OPTIONAL ONLY
-- The updated site package does NOT require this SQL fix because the admin page now avoids the fragile join.
-- But if you want Supabase/PostgREST to recognize a direct relationship between user_bounties and profiles,
-- you can add this direct foreign key.

alter table public.user_bounties
drop constraint if exists user_bounties_user_id_profiles_fkey;

alter table public.user_bounties
add constraint user_bounties_user_id_profiles_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;
