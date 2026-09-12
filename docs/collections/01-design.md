# Collections — design (2026-09-12)

## Decision: one level

A collection holds works (posts) directly. The item level is retired.
Reasons: the chosen reference presents collections that way; the item
level is where every gap in `00-findings.md` lives; production holds one
row. The old `collection_items` / `collection_item_posts` tables are left
in place, untouched, for one release so this is reversible; the one
existing link is copied into the new table. Dropping them is a later,
separate decision.

Vocabulary, everywhere: **collection**, **works**. Counts read
"11 works", or the type noun when every work shares a type
("11 photographs", "9 poems", "17 journal entries"). Empty: "Nothing here
yet". Copy is warm, no SaaS labels.

## Model

```
collection_posts (
  collection_id uuid → collections(id) on delete cascade,
  post_id       uuid → posts(id) on delete cascade,
  position      int  not null default 0,
  added_at      timestamptz not null default now(),
  primary key (collection_id, post_id)
)
```
A post may sit in several collections (cheap, harmless, avoids a
"move" flow). Only the post's author can put it in a collection, and only
into their own collection (enforced in the RPC, not trusted from the client).

RLS: `collections` SELECT stays public; `collection_posts` SELECT is
visible only when the post itself is visible to the caller (same rule as
`posts`). All writes go through SECURITY DEFINER RPCs; direct table
writes are revoked from `authenticated`.

RPCs (all check `auth.uid()` ownership):
- `save_collection(p_id, p_name, p_description, p_icon_emoji, p_icon_url, p_cover_url)` → row. Upsert; slug made and de-duplicated server-side; `updated_at` maintained.
- `delete_collection(p_id)`.
- `reorder_collections(p_ids uuid[])` → one statement.
- `set_post_collections(p_post_id, p_collection_ids uuid[])` → replaces the post's membership (composer, edit, "Add to collection" sheet).
- `add_posts_to_collection(p_collection_id, p_post_ids uuid[])` → appends (the "Add works" sheet).
- `remove_post_from_collection(p_collection_id, p_post_id)`.
- `reorder_collection_posts(p_collection_id, p_post_ids uuid[])`.
- `get_studio_collections(p_user_id)` → the shelf: each collection with `works_count`, `type_counts`, and up to three `previews` (`{post_id, kind: image|text, src, text}`) taken from the collection's visible posts in order. One round trip for the tab.
- `get_post_collections(p_post_id)` → `{id, name, slug}[]` for the "Part of" line.

Storage: uploads move to `covers/{uid}/collections/{collectionId|new}-{ts}.{ext}` so the owner-scoped bucket policies apply.

## The journey

**1. Start a collection.** Studio → Collections → the dashed "New
collection" stack (owner only) → the collection sheet: icon (branded /
emoji / image), optional cover, name, description. Save → the new stack
appears in place. The same sheet, with `collection` passed, is **Edit
collection** (menu on the stack, and in the open view).

**2. Put works in it.**
- *While writing*: the composer's "Collection" row becomes a row of
  chips, one per collection, multi-select, plus "New collection" which
  opens the sheet inline. The selection is saved in the draft and applied
  after publish with `set_post_collections`; failure toasts. Editing a
  post shows the same chips pre-checked, so membership can change later.
- *From any own post*: PostCard menu and detail-modal menu get
  "Add to collection" → the **collection picker sheet** (checkbox list of
  the owner's collections, "New collection" at the bottom). Saving calls
  `set_post_collections`.
- *From inside a collection*: owner's "Add works" → the **add-works
  sheet**: the owner's posts not already in the collection, newest first,
  with search, multi-select → `add_posts_to_collection`.

**3. Open a collection.** Click a stack → the **collection modal** opens
over the studio (URL swaps to `/studio/{u}/collections/{slug}` via the
same history mechanism the post modal uses; Back or Esc closes; the
direct URL renders the same view as a page for sharing). Layout: a
header with the cover (or icon on gradient), name, description, count,
and owner actions (Add works, Edit, Arrange, Delete); then the works as a
grid of tiles (media thumbnail, or text excerpt with a monochrome type
chip). Clicking a tile opens the existing post detail modal on top;
Back returns to the collection.

**4. Manage.**
- Arrange: an owner toggle in the open view; tiles get move-earlier /
  move-later arrows and a Done button; saved with `reorder_collection_posts`.
- Remove a work: tile menu → "Remove from collection" (no confirm: the
  post survives; a toast with Undo re-adds).
- Delete: existing confirmation copy.
- Shelf order: Move earlier / later stay (one statement now).

**5. On the post.** The post detail modal shows "Part of {collection}"
under the author line when the post sits in a collection (link opens the
collection modal). Feed cards stay untouched.

## Retired

`NewCollectionItemModal`, `CollectionSelector` (two-pane), the item route
`/studio/[username]/collections/[collection]/[item]`, `useCollectionItem`,
`useCreateCollectionItem`, `useAddPostToCollectionItem`, the
`CollectionItem*` types and the item interfaces with no bodies.

## Not in this pass

Dropping the item tables; deleting orphaned cover files from the bucket;
private-profile gating (open decision 10 in docs/profile); collection
membership on feed cards (would touch the feed RPC).
