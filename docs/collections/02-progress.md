# Collections — progress

Read `01-design.md` first. Phases run in order; each leaves `main` working.

| Phase | Scope | State |
|---|---|---|
| 0 | Findings + design docs | done 2026-09-12 |
| 1 | Migration: `collection_posts`, RLS, RPCs, grants, data copy, storage path | done 2026-09-12, applied to prod (`20260915_collections_phase1_flatten.sql`) |
| 2 | Hooks rewrite (`lib/hooks/useCollections.ts`) on the RPCs | done 2026-09-12 |
| 3 | Shelf on `get_studio_collections` (previews from works, type nouns) | done 2026-09-12 |
| 4 | Collection view: modal + page, tiles, Arrange, Remove, Add works sheet | done 2026-09-12 (modal stacks under the post modal via `pqUnder`) |
| 5 | Collection sheet create/edit; composer chips + draft; PostCard / detail "Add to collection"; "Part of" line | done 2026-09-12 |
| 6 | Retire item-level code, tsc/lint, browser pass, commit | code retired, tsc + lint clean, browser pass done 2026-09-12; uncommitted |

## Browser pass (2026-09-12, hadi's studio, localhost)

Shelf → stack click opens the collection modal (URL swaps, `pqModal:"collection"`);
Add works sheet added two posts (count "3 works", Arrange appeared, toast);
tile click opened the post modal on top (`pqUnder:"hadi/favorites"`, "Part of
Favorites" in the header); Back returned to the collection; Back again closed
it and the shelf had refetched ("3 works", previews from the works). Composer
shows the chips row; the post page menu shows "Add to collection" and the
picker opens with Favorites pre-checked.

## Left for later

- Drop `collection_items` / `collection_item_posts` (kept one release).
- Orphaned cover files in the `covers` bucket are never deleted.
- Private-profile gating of collections (docs/profile decision 10).
- Collection membership on feed cards (would touch the feed RPC).
- The composer's collections row still sits above the title (kept the old slot).
