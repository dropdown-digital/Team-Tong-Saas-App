# Team Tong — private rooms

## Supabase integration and safe cutover

Supabase email/password authentication, PostgreSQL storage and room-scoped Realtime notifications are implemented. **The local preview still uses SQLite until setup and verified import are complete.** Your supplied public configuration is saved privately in `.env.local`. Open [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for step-by-step dashboard, import, account-transition and rollback instructions. The publishable key alone cannot install the database or migrate records. No cloud users or records have been fabricated.

The current database was backed up before these changes. Existing users must create and confirm a Supabase account with the same email, then prove their legacy account using their previous Team Tong password once. Passwords are not assumed to transfer.


Open **http://127.0.0.1:3000/club** for real accounts and rooms. Sign in with your existing account. **My rooms → Team Tong → Open room** opens the founding club. Nothing has been deployed.

The original dashboard/demo remains at **http://127.0.0.1:3000/**. It uses fictional players and browser storage. Demo restrictions are not security. Real rooms use this computer’s SQLite database and authenticated server checks. Demo data has not been converted into accounts.

## What changed

The existing Next.js app, dark design, match screens, draft, rotations and complete-ballot rating experience were extended, not rebuilt.

- One account can belong to multiple private rooms. Roles and match records are separate for each room.
- Verified accounts create rooms with a name and optional logo. Names may repeat. The creator becomes the owner automatically.
- Eight-character codes let friends request membership. Only a room organizer can approve them. Pending/rejected applicants cannot access member-only content. Anyone holding the invitation code can now open the limited guest view described below.
- Owners appoint organizers, invite a successor to accept ownership, and archive/restore rooms. The previous owner stays an organizer after a successful transfer.
- Organizers can rotate invitation codes, approve/reject requests individually or in bulk, edit fixtures, and maintain official statistics.
- Room profiles and monthly/all-history leaderboards show actual football records. Only final ratings from matches the viewer personally unlocked contribute to rating summaries.
- Goals can have an unknown minute, no assist, unknown assist, or a recorded assist. Own goals credit the opposing side without adding to the scorer’s goal total. Score/event discrepancies are flagged.
- Organizers explicitly confirm the draft pool and, after play, the actual participants. Opening voting freezes eligibility.
- Profile portraits and room logos accept PNG/JPEG/WebP up to 256 KB. The server decodes, resizes and re-encodes them, removing metadata. Images are returned through authorized room/account responses.

## Try the redesigned draft now

Open **http://127.0.0.1:3000/club/draft-demo**. No login, email setup or second person is needed.

1. Choose 16, 18 or 20 fictional players and press **Start practice · toss coin**.
2. Tap any available player. The turn alternates automatically between Team White and Team Black.
3. Try **Undo**, **Simulate a disconnect**, and **Both captains ready · resume**. The toss and previous picks survive a pause.
4. Finish the picks to see equal teams, including captains. Each side has seven active players and one, two or three rotating players for 16, 18 or 20 attendees.
5. **Reset practice** only resets this temporary practice screen. Reloading also starts fresh. Your real rooms and matches are untouched.

The real draft uses the same new two-panel layout. Real picks still require the current captain’s own approved account, both captains online and ready, and a server-validated turn. Practice Undo/Reset do not bypass real draft rules.

## Add players who do not have accounts

Sign in as a room owner/organizer, open the room and expand **Organizer · Add and manage participants**. Enter a name and position. With an upcoming, unlocked match selected, the player is also marked Going; otherwise the profile is added to the room. Organizers can manage attendance before captains are selected. Confirm the draft pool using the existing match controls.

These are football profiles, not fabricated login accounts. They can be picked, appear in lineups, record playing time and receive ratings. Captains need their own approved accounts.

If that player later signs up and is approved, use **Connect a participant to their account** and confirm they are the same person. Their stable participant identity and previous match records remain intact. Linking never changes frozen eligibility or a submitted ballot. The app refuses automatic merging when the account already has separate match history; this avoids mixing two people’s records. An eligible linked player can submit their own complete ballot while voting is open.

## Enter a room without logging in

Open **http://127.0.0.1:3000/club/guest**, enter the organizer’s eight-character invitation code and press **Enter as guest**. The organizer’s Room Admin section also has an **Open guest entrance** link.

Anyone with that code can view fixture dates, turf locations, scores, participant names, teams and the live draft. Share it only with people you want to see this information. Guest access expires after 24 hours; rotating the invitation code or archiving the room revokes it immediately. Guest viewers cannot pick, change attendance/statistics, see ballots or rating results, or vote.

To rate, the person must sign in with their own account, be approved in the room, be confirmed as an actual match participant and submit a complete ballot. The existing anonymous-vote interface, no-self-vote rule, permanent ballot lock, three-vote minimum and provisional/final results remain unchanged. Login alone does not grant rating eligibility.

## Your existing data

The additive room migration has already been run on this local project. It found one approved organizer and used that account as the founding Team Tong room’s owner. Accounts, password hashes, the original club JSON and the founding-room JSON were compared against the backup and were unchanged.

The original `club` row remains as a migration snapshot. New room activity is saved in `rooms`; the old row is no longer the live club. No fictional account was added to your database. Existing sessions remain valid, though an in-progress draft must reconfirm captain readiness.

The private backup is in `web/.data/`, named `team-tong.sqlite.before-rooms-<number>.sqlite`. It includes committed WAL changes. Do not share that folder: it contains personal information and password hashes. Backups and `.env.local` are excluded from the source archive.

Migrations run automatically when the server opens its database, or explicitly with `npm run migrate`. Version 5 adds expiring guest-view sessions. Versions 2–4 add rooms/memberships/ownership/audits/presence/email tokens, profiles, and idempotent room-creation requests. They do not delete existing tables.

For rollback, stop **all** app processes first and make another SQLite backup of the current database. Restore the pre-room code and database together, into a separate test folder initially. Do not overwrite the working database or copy only its main SQLite file while the app is running; recent records may live in its WAL file. New records created after migration will not exist in the earlier backup. Ask for help before rolling back.

## Email setup: needed for new rooms and new join requests

Existing founding members retain access. Their old email addresses are **not** silently marked verified. New room creation and join requests require verification.

Verification/reset screens and expiring, single-use tokens are implemented. **Actual email delivery has not been configured or tested with a real mailbox.** No emails were sent during development. There is no fake “verified” button.

To enable email:

1. Create a [Resend account](https://resend.com/) and configure a sender you control. Follow its [sending documentation](https://resend.com/docs/api-reference/emails/send-email). A test sender may only be able to send to your own verified address.
2. In the `web` folder, create a file named `.env.local` containing these settings. Replace the placeholders **on your computer**, never in chat:

```dotenv
TEAM_TONG_ORIGIN=http://127.0.0.1:3000
TEAM_TONG_MAIL_FROM=Team Tong <your-verified-sender@example.com>
RESEND_API_KEY=your-private-resend-key
```

3. Stop the development server with Control+C in its Terminal, then run `npm run dev` again.
4. Sign in, open **My rooms**, click **Send verification email**, open the email link and click **Confirm email address**. Links expire after one hour.
5. You can now create another room or request membership with an invitation code. Creating a room opens **Room ready**, with its code and copyable invitation link.

Password reset is under **Forgot password?** on the sign-in screen. A completed reset invalidates existing login sessions. Email tokens are hashed in the database and cannot be reused.

Localhost links work only on this computer. They are not ready to share with friends on other devices. No Supabase or GitHub account is required for this preserved local backend; public hosting/HTTPS and an approved deployment plan are separate future work.

The previous `npm run organizer` shortcut is disabled: permissions now belong to rooms. Use the owning account’s **Room administration** controls.

## Weekly football flow

1. Open the correct room. An organizer creates a fixture using turf, date/time and total slot fee in BDT. Times are interpreted in **Asia/Dhaka**, not the viewer’s device timezone.
2. Members RSVP Going, Maybe or Not playing. Organizers check the actual **draft pool** separately. A later RSVP change clears that pool confirmation until reconfirmed.
3. Choose captains from the confirmed pool. This freezes attendance for drafting. An even roster of 14–30 is supported; odd/undersized rosters show an error instead of dropping someone.
4. Both captains sign in to their own accounts, open the match and press **Ready**. The server tosses once, then alternates one pick at a time. Only the current captain can pick.
5. On disconnect, picks pause. Hidden/closed tabs send a leave signal; silent connection loss is detected within the 15-second presence lease. Both captains must confirm readiness again. The toss and existing picks are preserved.
6. After picks begin, a replacement captain must already be drafted into that side. The previous captain stays on the roster. This follows the updated specification’s conservative rule; allowing an undrafted replacement after picks needs a separate decision.
7. Set the kickoff seven and formation, then start. Repeated rotations credit logged intervals to the current seven; an outgoing player can return. Unrecorded time is shown as not tracked.
8. Finish the match, correct official events/score, and check everyone who actually played. Choose a Dhaka-time voting deadline and press **Freeze participants & open ratings**. This participant list cannot be edited after the window opens.
9. Each participant rates every other actual participant from both teams, reviews the complete ballot and submits once. The ballot is permanently locked. Organizers see submission names, never individual scores.
10. Only submitters see averages/counts. Averages require three valid votes and are provisional while voting is open. Closing/deadline expiry makes them final. Highest unrounded eligible mean wins Player of the Match; exact ties share it. Nonparticipants cannot see rating results.

| Participants | Each team | Active per team | Rotating per team |
| --- | --- | --- | --- |
| 16 | 8 | 7 | 1 |
| 18 | 9 | 7 | 2 |
| 20 | 10 | 7 | 3 |

Both sides are always **Team White** and **Team Black**. Nobody is a permanent substitute. The shared lineup and full roster continue to credit rotating players.

## Running it later

Open Terminal (Command+Space, type Terminal) and paste:

```sh
cd "/Users/anuwaves/Documents/Codex/2026-10-21/you-are-my-senior-full-stack/web"
npm run dev
```

Leave Terminal open, then visit **http://127.0.0.1:3000/club**. Control+C stops the server. If port 3000 is occupied, use the existing preview or stop its previous Terminal session; don’t delete the database.

Dependencies are installed. On a new machine, install Node.js 24, run `npm ci`, then `npm run dev`. An optional `TEAM_TONG_DB` environment variable chooses a different SQLite path. Do not change it on this installation unless intentionally moving the database.

## Validation and limits

39 automated tests passed, plus lint and production build/type checking. Tests cover preserved legacy migration/backup, room isolation, scoped permissions and presence, invite rotation, approval, ownership transfer, archive/restore, draft turn rules, rotations, eligibility freeze, ballot privacy and locking, own goals, email token lifecycle, and room-creation retries.

Email sending was tested with a mocked provider response, not real delivery. Browser checks used an isolated temporary database at 375px and desktop sizes; no test members were added to your real database. The room switch correctly showed a fixture in one room and an empty history in another.

This implementation retains the existing SQLite authentication/server architecture. It **does not implement or claim Supabase Auth, Postgres RLS or Supabase Realtime**. Server transactions enforce authorization; synchronization uses authenticated polling every two seconds. This is suitable for reviewing the local app, not a claim of production-scale hosting. Node currently prints an experimental SQLite API warning.

Optional advanced analytics, custom season boundaries, popular-vote MOTM, payment collection, public hosting and destructive room deletion are not implemented. The separate local demo and its backup/import controls are unchanged. See `ROOMS_AUDIT.md` and `PHASE_2_ARCHITECTURE.md` for implementation details.
