# Team Tong — rating-first local MVP

Team Tong is a private football clubhouse demo. **Team White and Team Black** are the two sides everywhere. The main post-match action is **Rate this match**. Match scheduling, 7v7 lineups, repeat rotations, goals, assists, cards, fees, profiles and history remain available.

No real accounts, Supabase setup, GitHub setup or deployment are needed. Original files in `/Users/anuwaves/Downloads/team_tong_/` remain untouched.

## Open and try it

Open http://127.0.0.1:3000/matches/m2 on this Mac. This is a local address, not a public website. The development server must be running.

1. Select the Ratings tab if it is not already selected. Completed matches open here automatically.
2. Older sample matches may have a closed voting window. Click **Try a sample match** to create a separate fictional walkthrough. Your existing matches are preserved.
3. The walkthrough includes 18 actual participants and four fictional completed peer ballots. You start as Rafi Hasan with no submitted ballot. These sample opinions are not real assessments.
4. Choose a rating from 1.0 to 10.0 in half-point steps, then **Next player**. Rate all 17 other participants, including both teams and everyone who rotated on. You cannot rate yourself. No scores are preselected.
5. Watch the progress bar. Draft choices save on this browser, so you can refresh or come back later.
6. **Review ballot** shows your own choices. Use **Edit** to change a rating. The submit button stays disabled until you have rated every peer and acknowledged the permanent lock.
7. **Submit & lock all 17 ratings** submits the whole ballot together. There is no edit or resubmit option afterward, even if voting reopens.
8. All 18 participants now appear in the results, including you. Each row shows the count of valid votes. An average appears only with three or more votes; otherwise it shows a dash. Individual votes and voter names are not listed in results.
9. Results are **Provisional** while voting is open. Organizer tools can close voting to mark them **Final**, or reopen a window (making results provisional again, without unlocking any submitted ballot). The normal deadline is 48 hours after the match ends. An unsubmitted viewer still cannot see results after closure.

The demo viewing selector lets you test another participant or a nonparticipant. It is not a sign-in screen. An unsubmitted viewer cannot see match results through the pitch, player detail sheet, or season rating summaries. Season averages include only unlocked, final match results with at least three votes. Exact tied final means share the rating-based Player of the Match award.

## What “local demo” means

Everything stays in this browser, under the `team-tong-phase1` storage key. Different browsers/devices do not share data. Switching the demo viewer is unrestricted. Organizer controls are open to everyone.

**Locks, result hiding and anonymity are interface rules, not real security.** Browser storage, exported backups and developer tools contain raw demo ballots and can change/reset them. The app does not promise confidentiality against someone inspecting local data. Submitted individual choices are not displayed in the interface, even when switching viewers. Your own draft is visible during review only.

Old individual votes are preserved in storage/backups but do not count as complete ballots. Older matches with no `played` list use positive recorded minutes to identify actual participants; an RSVP or team assignment alone is not enough. No historical rotation or ballot submission is invented. A fresh walkthrough is the simplest way to test the new rules without changing old records.

## Start it again later

Open **Terminal** (Command + Space, type Terminal, press Return). Paste these commands one at a time and press Return after each:

```sh
cd "/Users/anuwaves/Documents/Codex/2026-10-21/you-are-my-senior-full-stack/web"
npm run dev -- --port 3000
```

Leave Terminal open, then open http://127.0.0.1:3000/matches/m2 in Safari or Chrome. To stop the server, press **Control + C** in Terminal.

Dependencies are already installed. If moving the project to another computer, install Node.js 22 or newer (24 used here), then run `npm ci` in the `web` folder before starting. No new dependencies were needed for this rating redesign.

## Match and rotation features

Scheduled matches have real date/time fields (Dhaka), turf, RSVPs and duration. Confirm 18 attendees to assign nine players per team, seven active and two rotating. Before kickoff, choose 2-3-1 + goalkeeper, 3-2-1 + goalkeeper, or 2-2-2 + goalkeeper, positions and captains. Starting the match freezes a kickoff snapshot. Log time and rotate players repeatedly; nobody becomes a permanent substitute. Finish the match to open ratings. Only recorded contributions are shown; possession, passes and xG are not invented.

## Implementation and verification

Built using Next.js App Router, React, TypeScript and Tailwind CSS, with scoped Match Center styling.

- `src/components/match-center/MatchRatingFlow.tsx`: progress, one-player rating steps, full review, submission and aggregate results.
- `RatingInput.tsx`: accessible half-point choices without a default score.
- `src/lib/domain.ts`: eligibility, actual participants, drafts, complete submission, permanent lock, three-vote arithmetic means and validated backup shape.
- `src/components/provider.tsx` and `src/lib/repository.ts`: shared browser state/persistence boundary. No authentication or shared database is simulated.
- Other Match Center components retain the pitch, match header/tabs, player sheet and substitution timeline.

Run checks from the `web` directory:

```sh
npm test
npm run lint
npm run build
```

All 20 tests, lint and production build pass. Tests cover 18-person rotations and minutes, score updates, deadlines, actual participation, complete ballots, edit-before-submit, permanent locks, invalid/self/outsider votes, minimum vote counts, result gating and backup validation. Browser checks at 375px and desktop covered all 17 ratings, draft persistence after refresh, review/edit, disabled premature submission, locked submission after refresh/reopening, all 18 result rows, provisional/final transitions, hidden pitch ratings before submission, and nonparticipant restrictions.

`npm run build` checks a production build locally; it does not deploy. `npm start` can serve that build locally after stopping the development server if it uses the same port.

## Later accounts and Club Admin — plan only

See `PHASE_2_ARCHITECTURE.md`. No real authentication, schema migration, account provider or hosting integration has been added. The next step is your review of this core experience.
