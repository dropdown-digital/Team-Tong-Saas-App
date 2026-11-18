# Team Tong architecture after private rooms

The application continues to use Next.js App Router, React, TypeScript, Tailwind and the original dark components. The live surface is `/club`; the original `/` routes are explicitly fictional local demo screens. The browser’s old localStorage is untouched.

## Live data and authorization

`src/lib/server/database.ts` owns SQLite schema migrations and transactions. Existing accounts/scrypt hashes, sessions, club JSON and audit records are retained. A safe `VACUUM INTO` snapshot precedes tenancy migration. Rooms have opaque UUIDs; their match aggregate retains existing stable match/player/event IDs. Memberships, ownership transfer requests, scoped presence, audits, email tokens, account profiles and room-creation request IDs are relational tables.

`rooms.ts` derives the effective role from approved membership, never a client role/global legacy organizer flag. `service.ts` loads only the selected room’s aggregate and validates mutations under `BEGIN IMMEDIATE`. An authorized room alone does not authorize a guessed match belonging elsewhere. Presence checks require the same room plus an unexpired authenticated session and approved membership. The original legacy service path is used only by regression tests, not exposed by `/api/club`.

`route.ts` enforces same-origin POSTs and HttpOnly SameSite Strict cookies; HTTPS enables Secure cookies. Responses are private/no-store. `TEAM_TONG_ORIGIN` pins the origin when configured. Invite preview grants no private read capability. Creation/join/lookup/email attempts are rate limited. Idempotency keys prevent repeated room-creation form submissions from making duplicates.

## Ratings and history

Opening a new real-room rating window freezes the organizer-confirmed actual-participation snapshot. Drafts are private, full ballots submit atomically and permanently, and window reopening is rejected. Existing completed legacy rating windows retain their eligibility/ballots. Projections remove all individual vote rows and other voters’ drafts. Only an actual participant with their own submitted ballot receives aggregated results. Three valid votes are required; full-precision means decide exact shared POTM ties. Organizer progress reveals only submitter IDs. Profiles and leaderboards reuse these projections and include only unlocked final averages.

## Email and images

`email.ts` sends verification/reset links through a configured Resend sender. Tokens are random, hashed, one-hour and one-use. Reset invalidates all sessions. No auto-verification or public credential/organizer bootstrap exists. Actual delivery requires local environment configuration and mailbox testing. Email tokens use URL fragments, avoiding request-log query strings.

`images.ts` accepts bounded PNG/JPEG/WebP data, decodes with pixel limits and produces small WebP thumbnails without metadata. No public image storage paths or arbitrary remote image fetching are introduced. Profiles are shared identities, while all football statistics stay scoped to the active room.

## UI and synchronization

`live-club.tsx` reuses the existing match/rotation/rating UI; `rooms.tsx` handles the room hub/governance and `room-players.tsx` renders authorized profiles. Room changes remount/reset local state and fetch fresh server roles. Polling every two seconds replaces a websocket service; captain leases expire after 15 seconds and reconnect requires explicit Ready. These are real shared server writes, not localStorage simulations.

## Future hosted backend

No Supabase account is configured and no RLS/realtime integration is claimed. Before hosting: choose the approved infrastructure, HTTPS/session/origin settings, backups/restore rehearsals, email sender, retention and monitoring. If migrating to Supabase, preserve IDs/hashes/accounts through a reviewed identity migration, normalize the match aggregate with room foreign keys, implement transactional functions and deny-by-default RLS, and repeat the cross-room/ballot tests against that actual service. Do not replace the working authentication silently or place service-role keys in browser code.

No deployment was performed.
