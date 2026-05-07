# Rev-N-Rip Flat Images Version

This package fixes broken image issues by removing the assets folder dependency.

All images now live in the root beside the HTML files.

Missing local image references found during build: 0

Forms still require replacing:
YOUR_FORMSPREE_FORM_ID


## Full code package with popup ready
This version includes revnrip-popup.js in the root and adds:
<script src="revnrip-popup.js"></script>
before </body> on all HTML pages.

Upload all files in this ZIP directly to your GitHub repository root.


## Seamless forms and popup update
Added revnrip-site.js to control the popup and all forms.
If Formspree is not connected, forms open a pre-filled email to Info.revnrip@gmail.com instead of failing silently.


## Streamlined homepage update
Removed/moved from the front experience:
- Collector Type Quiz
- Mystery Door

This keeps the site focused on the main customer paths:
Shop Cards, Sell Cards, Live Breaks, and Star Rare Vault.


## Featured Drop update
Added a modern, streamlined Featured Drop section:
- one main featured drop
- two supporting action cards
- clear CTAs
- premium glass/neon styling
- mobile responsive layout


## Viral TCG Hooks Added
Added:
- Grail Garage
- Bounty Board 2.0
- Vault Claim Cards
- The Rev-N-Rip Report
- Tag a Collector copy buttons
- Bounty of the Week
- Collector Hall of Fame

These sections are designed to create shareable collector moments and encourage community participation.


## Standalone Bounty + Grail pages
Added:
- bounty.html
- grail-garage.html

Moved Bounty Board and Grail Garage out of the main page flow.
Featured Bounty now appears at the top of bounty.html.


## Live Breaks hidden
Live Breaks has been hidden from the customer-facing navigation and homepage/marketplace flow.
The file `breaks.html` remains in the package for future use when breaks are ready to launch.


## Tight / Classy / Viral structure update
Changed:
- Homepage is now a 4-lane command center:
  Shop Cards, Sell / Consign Cards, View Bounties, Star Rare Vault
- Bounty Board + Grail Garage are now the main viral engine.
- Added a clean viral CTA strip across key pages:
  View Bounties / Submit Your Grail
- Reduced homepage clutter and clarified the site roles:
  Homepage = clarity
  Bounty/Grail = viral sharing
  Vault = prestige
  Sell page = conversion
  Marketplace = shopping


## Combined Vault + Grail Garage update
Changed:
- Grail Garage is now combined into the Vault page.
- syndicate.html now has two selectable sections:
  1. Star Rares
  2. Pokémon
- All current entries were placed under Star Rares.
- Pokémon section is ready for future entries.
- grail-garage.html is kept as a light redirect-style page for old links.


## Bounty response buttons
Added future-use "I Have This" buttons under Bounty Board listings.
These buttons are intentionally not linked yet.


## Bounty Board featured bounty layout
Updated bounty.html so the Featured Bounty is now the first thing on the page.
It is centered, oversized, and uses the Sacred Fire 5/10 image (img-006-bd94dee1d5d0.webp) below the headline.


## Images folder update
All image files have been moved into a single folder:
images/

Image references in HTML/JS were updated accordingly.

Missing local image references during build: 0


## Tight archive + bounty featured update
Changed:
- Removed the large Pick the Archive door section from syndicate.html.
- Added two small top toggle buttons: Star Rares / Pokémon.
- Removed the Featured Relic section entirely.
- Kept current entries under Star Rares.
- Pokémon remains ready for future entries.
- Verified image references after path normalization.

Missing image references found during build: 0


## Popup repair update
Rebuilt revnrip-site.js as a standalone popup + form controller.
Verified:
- revnrip-site.js added to all HTML pages
- logo path points to ./images/revnrip_logo_transparent.png
- logo file exists: True
- missing script pages: []


## Unique bounty links
Added unique anchor links for individual bounty entries:
- bounty.html#sacred-fire-5-10
- bounty.html#metazoo-red-ink-blue-ink
- bounty.html#psa-10-umbreon
- bounty.html#sealed-vintage-pokemon
- bounty.html#native-serialized-metazoo
- bounty.html#high-end-slabs

Each bounty now has a Copy Link button that automatically generates the full URL.


## Full login/profile/user bounty system
Added Supabase-powered:
- User registration with email/password/site username
- Login
- User dashboard
- User bounty submission
- My Bounties list
- Admin approval page
- Public approved user bounties on bounty.html

Read LOGIN_SYSTEM_SETUP.txt and run supabase-setup.sql in Supabase.


## Supabase key update
The Supabase public/publishable key has been added to supabase-config.js.
The Project URL still needs to be filled in.
Never add a Supabase secret key to browser-side code.


## Supabase URL configured
supabase-config.js now includes:
https://qbrrbanvyvdpqzhlclck.supabase.co

The website uses the base Supabase project URL, not the /rest/v1/ API path.


## Internal chat system added
Added:
- messages.html
- conversation.html
- revnrip-chat.js
- supabase-chat-setup.sql
- unread message bell icon in navigation
- "I Have This" buttons open message flow
- private conversations tied to bounties
- message reports table

Run supabase-chat-setup.sql in Supabase after the main supabase-setup.sql.


## SQL view fix
Fixed `supabase-chat-setup.sql` so it drops `public.user_bounties_public` before recreating it.
This resolves:
ERROR 42P16 cannot change name of view column "title" to "user_id"


## Account Hub fix
Account page now behaves as a logged-in hub.
Logged-in users see tools, bounties, messages, and admin options instead of being asked to log in again.
Messages nav is now auth-aware and only shows once logged in.


## Account session hard fix
Replaced account auth handling so auth.html shows different content for logged-in users vs visitors.
It now uses Supabase getSession(), persistent sessions, and email redirect handling.


## Messages visibility + unread alert fix
Messages tab is now hidden by default and only appears once a user is logged in.
Unread message count now updates the bell badge and highlights the Messages link.


## Login visibility fix
Visitors now always see the Account/Login option.
Messages remains hidden until login.
auth.html now defaults to visible login/register forms for visitors and switches to Account Hub after session detection.


## No email app on login fix
The generic form fallback no longer intercepts Supabase forms.
Login/register/dashboard/message forms are now handled only by the auth/chat scripts and will not open the user's email app.


## Admin bounty relationship fix
Fixed admin bounty loading so it no longer requires a direct Supabase relationship between `user_bounties` and `profiles`.
The admin page now loads bounties and profiles separately, then combines them in the browser.


## Bounty submission fix
Dashboard bounty submission now shows clear success/error results and reloads My Bounties after insert.
Added `FIX_bounty_submission_rls.sql` for common Supabase RLS/profile issues.


## Bounty Board submission garage
Added a themed garage-style bounty submission form directly on bounty.html with login-aware submission handling.


## Bounty Board final polish
Added animated glow, shimmer, parallax, removed Viral Role section, moved Submit Your Bounty above listings, and added Pokémon / MetaZoo filters.


## Bounty Board mission-control update
Compressed the Bounty Board into a mission-control layout with a shorter featured section, collapsible garage-door submit form, compact bounty cards, unified static/community board, microcopy, and sticky quick controls.


## Admin decision alerts update
Admin approval bay now shows pending bounties only. Approve/Deny removes the bounty from the list, Deny supports an admin note, and decisions send an internal message notification to the bounty owner.

Run `SUPABASE_bounty_decision_notes.sql` to add the `admin_response` column for denial reasons.


## Admin active bounty manager
Admin page now includes an Active Bounties manager for approved/live bounties. You can edit, move back to pending, deny with a note, or delete forever.
If permanent delete fails due to Supabase RLS, run `SUPABASE_admin_delete_bounties_policy.sql`.


## Private Admin nav button
Added a hidden-by-default Admin button that only appears for logged-in user `xflight1125@gmail.com` or profile username `Metazoo King`.


## Copy link icon update
Bounty Board copy-link text buttons were replaced with small subtle copy icons in the upper-right corner of each bounty box.
