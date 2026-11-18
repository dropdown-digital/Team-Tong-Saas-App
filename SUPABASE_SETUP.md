# Connect Team Tong to your Supabase project

The existing app has been extended, not rebuilt. Its design, room permissions, guest entrance, organizer-created participants, captain draft, rotations and rating flow are retained.

**Current state:** the supplied project URL and publishable key are saved in `.env.local`. The Supabase Auth endpoint was checked successfully: email signup is enabled and email confirmation is required. The app deliberately still uses SQLite until you install the schema and import your records. No cloud accounts were created and no real emails were sent during testing. Nothing has been deployed.

Your publishable key is safe for browser authentication; it cannot create tables or import private records. The remaining setup needs access to your Supabase dashboard and a server-only database connection URI. You do **not** need to send a database password or service-role key in chat.

## 1. Install the database schema

1. Open your project in the Supabase dashboard: https://supabase.com/dashboard/project/qelqglvsrfxchlvorqgw
2. Click **SQL Editor**, then **New query**.
3. Open `supabase/migrations/001_team_tong.sql` in this project's `web` folder. Copy its entire contents into the SQL Editor and click **Run**.
4. It creates a private `team_tong` schema and a safe `public.team_tong_room_activity` table for live notifications. It does not delete existing tables or modify Supabase users. It can be run again safely.
5. Do not add `team_tong` to the Data API's exposed schemas or grant browser roles access to it. Do not enable Realtime on private room payloads; they contain individual ballots. The migration publishes only the room activity table.

## 2. Configure email and local redirects

In **Authentication → Providers / Sign In**, keep Email enabled and **Confirm email** enabled. In **Authentication → URL Configuration**:

- Site URL: `http://127.0.0.1:3000`
- Allowed redirect URL: `http://127.0.0.1:3000/auth/callback`
- Also allow: `http://127.0.0.1:3000/auth/callback?next=password`

Use this exact hostname consistently. Confirmation and reset use PKCE; open the email link in the same browser where you requested it. An expired link or a different browser may require a new email. Do not alter the standard Supabase confirmation template to skip its verification link.

Supabase's built-in email service has recipient and rate limits. Configure your own SMTP sender in Supabase for actual club members, then test confirmation and reset with your own mailbox. The old Resend configuration belongs to the SQLite backend and is not used for Supabase accounts.

## 3. Add the private database connection on your computer

1. Click **Connect** in Supabase. Choose **Session pooler**, PostgreSQL URI. It supports IPv4 and is appropriate for this local Next.js server. Copy the URI, replacing its database-password placeholder with your database password. URL-encode special characters in the password.
2. Open `web/.env.local` locally. Add this line with your real URI:

```dotenv
SUPABASE_DB_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DATABASE_PASSWORD@YOUR_POOLER_HOST:5432/postgres
```

The host must come from **your** project's Connect dialog; do not copy the example host literally. Keep `TEAM_TONG_BACKEND=sqlite` for now. This URI is a server credential: never prefix it with `NEXT_PUBLIC_`, put it in chat, include it in a source archive, or share it. The app verifies the PostgreSQL TLS certificate. Do not add `sslmode=disable` or disable certificate checks.

3. Open Terminal. On this computer, paste this command first (the quotes matter):

```sh
cd "/Users/anuwaves/Documents/Codex/2026-10-21/you-are-my-senior-full-stack/web"
```

Then run:

```sh
npm run supabase:check
```

Before the URI is added, this intentionally reports "Database: setup pending." After setup, it should show the schema version and account count. At this stage the account count can be zero because import is next.

No service-role key is needed: authentication uses the publishable key and server database access uses the private PostgreSQL URI. PostgreSQL is accessed only by the trusted Next.js server, whose handlers enforce room and organizer rules.

## 4. Back up and import existing records

Ask everyone to stop using the app during this short cutover. Stop the running development server first (Control+C in the Terminal running it). In a Terminal in `web`, run:

```sh
npm run supabase:import -- --confirm-stopped
```

The import takes another complete SQLite backup, including committed WAL records, in `web/.data/`. It locks local writes during the import, refuses a nonempty target, copies accounts and every room/match/ballot payload without changing IDs, and compares every imported row before committing. A failed verification rolls back the entire cloud import. A retry of the exact same completed import does not overwrite anything. Conflicting data causes an explicit stop rather than a merge.

Your original SQLite database remains intact. Existing local session cookies, guest tokens, email links and captain presence are not transferred; users must sign in again and captains must reconnect and press Ready. Team selections, original coin toss, turn order, rotations, complete ballots, account roles, room membership and match records are preserved. Local password hashes stay in a private legacy field only for the one-time identity check; they are **not** installed as Supabase passwords.

The backup taken before implementation contained **1 account, 1 room and 2 matches**. The importer uses your current data at cutover, not that earlier snapshot. `.data/` and `.env.local` are excluded from version control and source archives. Keep backups private; they contain password hashes and private votes.

## 5. Switch the app after the import succeeds

Change just this line in `.env.local`:

```dotenv
TEAM_TONG_BACKEND=supabase
```

Then run:

```sh
npm run dev
```

Open **http://127.0.0.1:3000/club**. The page will say **Supabase accounts & database**. Once this mode is enabled, database or authentication failures stop the request; the app never silently falls back to SQLite or creates an empty replacement club.

If configuration fails **before anyone writes new cloud records**, you can change the backend back to `sqlite` and restart to use the preserved local app. After people start using Supabase, do not switch back casually: SQLite will be an older snapshot. Stop writes and make a cloud backup before planning a reverse migration. Never overwrite your current database with an old backup without reviewing the records created since then.

## How existing members keep their history

Old Team Tong passwords do not automatically become Supabase passwords.

1. On the sign-in page, choose **Create an account**. Use the **same email address** as the old Team Tong account, and choose a new Supabase password.
2. Confirm the email sent by Supabase.
3. Sign in using the new Supabase password. In **Previous Team Tong password · first-time transition only**, enter the old local password once.
4. The server checks the verified Supabase identity and old password, then links to the original account ID. Existing room roles, player profiles and match history remain attached. Future sign-ins need only the new password.

New members simply sign up, confirm email and request room approval. Nobody receives an organizer role from signup metadata. Existing account suspension remains enforced.

If a member forgot their old local password, the organizer must verify the person's identity. A Supabase password reset only resets the new Supabase password; it cannot prove ownership of old match history. After the member creates and verifies a Supabase account, an administrator with SQL Editor access can inspect both records:

```sql
select a.id as legacy_account_id, a.email, u.id as supabase_user_id,
       u.email_confirmed_at
from team_tong.accounts a
join auth.users u on lower(u.email) = lower(a.email)
where lower(a.email) = lower('MEMBER_EMAIL_HERE');
```

Only after checking the person and the two IDs, link that **one** account using the IDs you just verified:

```sql
insert into team_tong.auth_links(auth_id, account_id)
select u.id, a.id
from auth.users u, team_tong.accounts a
where u.id = 'VERIFIED_SUPABASE_USER_ID'::uuid
  and a.id = 'VERIFIED_LEGACY_ACCOUNT_ID'
  and lower(u.email) = lower(a.email)
  and u.email_confirmed_at is not null
  and a.status <> 'suspended';
```

Unique constraints reject an account that is already linked; do not delete or overwrite a link to bypass that check. This recovery has no public API button.

## Guest viewing and live drafts

The existing `/club/guest` entrance continues to accept a room invitation without login. Guests see only the whitelisted fixture/team/draft view, never private votes, rating results or membership records. Their guest session is stored in PostgreSQL after cutover. Rotating the code or archiving a room revokes it.

Approved members receive Supabase Realtime room revision notifications and fetch fresh data through the authenticated API. Two-second polling remains as a fallback and for guest spectators; server-validated heartbeats retain the 15-second disconnect timeout. Reconnect still requires both captains to press Ready. Database transactions serialize draft/ballot mutations across application processes, preserving the toss and rejecting stale or out-of-turn picks. Guests do not receive a public raw room-data subscription.

The practice draft at `/club/draft-demo` remains fictional and isolated, with no login or database dependency.

## Validation and limits

**39 tests, lint and production build passed.** The original account, room payloads, memberships and profiles were compared with the pre-change backup and are unchanged. Run `npm test`, `npm run lint`, and `npm run build` to repeat the checks. Tests include the original room/draft/rotation/ballot rules, a PostgreSQL engine test of the actual schema and RLS policies, verified legacy-account binding, concurrent draft requests, and private locked ballots. PostgreSQL tests use an isolated PGlite engine; the advisory lock is represented by a serialized test connection. This does not replace a real two-browser check of Supabase Realtime after configuration.

Still required after setup: confirm and reset an actual email account, verify the import counts, sign in from two browsers as the captains, make alternating picks, disconnect/reconnect, then complete a test match and rating window. Remote PostgreSQL import, actual email delivery and live Supabase subscriptions have not been claimed as tested before the required dashboard/connection setup exists.

Architecture: room aggregates retain their existing JSON format in PostgreSQL to preserve data exactly. Private relational tables hold membership, identities, presence and governance. Browser roles have no access to private payloads; server routes enforce permission checks and project anonymous results. The one public Realtime table has SELECT-only room-membership RLS and contains only room IDs and revision numbers. No secret/service-role key or database URI is shipped to the browser.

Official references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

Dependency audit: no production dependency vulnerabilities were reported. npm reported five high-severity development-only advisories in the existing Next.js ESLint / fast-glob / micromatch / braces chain, with no automatic fix available. No forced dependency upgrade was applied.
