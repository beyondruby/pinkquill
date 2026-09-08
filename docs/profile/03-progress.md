# Profile, feed and post view — progress

Read `00-system-map.md` for what exists, `01-findings.md` for what is wrong
(ids), `02-plan.md` for the sequence. This file is the only place session
state lives; update it at the end of every sub-phase.

## Status

| Sub-phase | Root cause | Status | Commit | Notes |
|---|---|---|---|---|
| 1a | RC-1 takes grid gutter | **done 2026-09-08** | see git log `fix(profile): stop the takes grid` | removed `background:#000` + the no-op mobile block from `.takes-grid` (app/globals.css). Verified 0/1/2/5 takes and Relays→Takes at 1400 px and phone width; tsc 0 errors, lint 0 errors (166 pre-existing warnings), 223 tests pass |
| 1b | RC-2 policies / grants | **done 2026-09-08, applied to prod** | see git log `fix(profile): hide email from the browser` | migration `20260913_profile_phase1b_grants.sql` (table grant on profiles replaced by column lists for anon/authenticated; `takes_select` mirrors `posts_select_policy`). Client: `lib/profiles/columns.ts`, explicit columns in `useProfile` + `AuthProvider`, client insert no longer writes email. Verified: DB role checks, REST as anon (select=* → 401, select=email → 42501, id/username → 200), feed/profile/settings in browser as owner. Found decision 10 (private accounts not enforced server-side for posts or takes) |
| 1c | RC-3 loading/error signal | not started — **next** | — | |
| 1d | RC-4 unchecked writes | not started | — | |
| 1e | RC-5 in-flight guards | not started | — | |
| 1f | RC-6 one mapper | not started | — | |
| 1g | RC-7 modal history | not started | — | |
| 1h | RC-8 pub/sub + memo | not started | — | |
| 1i | RC-9 follow | not started | — | |
| 1j | RC-10 enrichPost / stats | not started | — | decision 2 |
| 1k | RC-11 pagination | not started | — | decision 9 |
| 1l | RC-12 take player | not started | — | decision 3 for V-19 |
| 2a–2f | technical quality | not started | — | |
| 3 | profile UI/UX | not started | — | one-sentence list needs approval first |
| 4 | feed UI/UX | not started | — | same |
| 5 | post/take view UI/UX | not started | — | same; decision 8 |

## How to resume

1. `git status` must be clean except `tsconfig.tsbuildinfo`.
2. Pick the first row above that is "not started" or "in progress".
3. Re-read that sub-phase in `02-plan.md`; confirm the findings it cites
   still reproduce (the `file:line` references were taken at commit 706a1ab
   and will drift as phases land).
4. Dev server: `npm run dev` (port 3000). Test users: `hadi` (owner, 1
   take), `hii` (2 takes), `poet1` (5 takes), `poet` (0 takes).
5. On finish: lint, typecheck, tests, browser check at desktop and 390 px,
   commit with the message given in the plan, update this table.

## Session log

- 2026-09-08 — plan approved by the user; 1a done and committed.
- 2026-09-08 — 1b SQL shown, user replied "apply"; migration applied to prod and committed. New column on `profiles` = add it to the GRANTs and `lib/profiles/columns.ts`.

## Decisions log

| # | Question (see plan) | Answer | Date |
|---|---|---|---|
| 1 | 1b DB changes | approved ("apply") | 2026-09-08 |
| 2–10 | — | pending | — |
