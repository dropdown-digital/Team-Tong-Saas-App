# V2 rooms audit and implementation record

Source: `TEAM_TONG_CODEX_SPEC_V2_ROOMS.md`. The user requested additive changes, preservation of working behavior/data/design, local tests, and no deployment.

| Area | Before | After / evidence |
| --- | --- | --- |
| Next.js, dark match UI, separate demo | Implemented | Preserved, reusable MatchCenter retained |
| Real accounts, private sessions | SQLite implementation | Preserved; profile, email-token verification/reset added |
| Supabase Auth/Postgres/RLS/Realtime | Not configured | Not substituted for existing backend; no Supabase tests claimed |
| Rooms, invites, memberships | Missing | Stable IDs, cryptographic eight-character codes, approved membership checks, role isolation |
| Ownership and organizer appointments | Global role only | Room ownership, accepted transfer, protected owner, archive/restore |
| Legacy data migration | Missing | Versioned additive schema, private SQLite snapshot, original club JSON retained |
| Fixture creation, RSVP | Implemented | Room-scoped; fixture editing, draft-pool confirmation, Dhaka countdown/share summary |
| Captain draft, presence, rotations | Implemented | Room-scoped; conservative replacement after picks; 14–30 even rosters |
| Official stats | Partial | Unknown goal minute, assist status, own goals, mismatch warning, room audit |
| Complete rating ballots/privacy | Implemented | Preserved; separate actual-participant confirmation and frozen window opening |
| Profiles, leaderboards | Demo-only | Real room profiles, basic monthly/all-history football leaders, safe final-rating summaries |
| Logos and portraits | Partial | Bounded image uploads, server re-encoding, authorized responses |
| Actual email delivery | Unconfigured | Resend adapter ready; external sender/key configuration still required |
| Deployment | Not authorized | Nothing deployed |

Checks: 33 automated local tests, lint, build/type-check; 375px and desktop browser room switching. Email provider test uses a mocked HTTP response. No hosted database, Supabase or real-mailbox tests were run.

Privacy boundary: every live API match command requires an explicit room ID and approved membership in that room. Data payloads have an unambiguous room parent. Presence is room/match/session-scoped. Public invitations expose only name/logo. Ballot projection removes raw votes, all other voters’ drafts and ballot markers. Organizer progress lists identities only. Audit entries omit rating values. Room profiles consume the same authorized match projection and never join other room histories.

The original private database was checked after migration: exact legacy payload, founding-room payload and original account columns matched its pre-migration backup. Original prototype/spec files were not changed.

Known scope differences from the preferred architecture: SQLite payloads retain the existing match aggregate, rather than replacing all football records with normalized PostgreSQL tables. Server authorization/transactions provide the local security boundary; there is no RLS claim. Disconnect detection remains bounded by the existing 15-second lease, not instantaneous transport-level detection. Advanced leaderboard metrics/season definitions, popular-vote MOTM and optional payment workflows remain future enhancements.
