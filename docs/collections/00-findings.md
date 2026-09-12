# Collections — findings (2026-09-12)

Audit of the collections feature as it stood after the shelf redesign
(commit 4a80d93). Facts only; the design that answers them is in
`01-design.md`.

## Model as built

Three tables, created in the dashboard (no CREATE in the repo):
`collections` → `collection_items` → `collection_item_posts` → `posts`.
A collection holds "items" (album / book / series), an item holds posts.
Production has 1 collection, 1 item, 1 link: the feature is unused.

## What a user can do today

- Create a collection or item **only inside the post composer**
  (`CreatePost.tsx` → `CollectionSelector` → `NewCollectionModal` /
  `NewCollectionItemModal`), and only while creating, never while editing.
- Attach the post being written to an item. Choosing "Collection Root"
  in the selector saves nothing and says nothing (there is no
  collection→post relation).
- Attach failures are swallowed (`addPost` returns false; the `catch`
  never fires). The choice is not part of the draft.
- View: studio shelf (fanned stacks, "n pieces" = item count) →
  collection page (item tiles) → item page (PostCards with no engagement
  data: 0 admires, 0 relays, no save state, always).
- Manage: shelf menu = Move earlier / Move later / Delete; collection
  page = remove item. Nothing else.

## What a user cannot do

- Rename or re-cover a collection (`useUpdateCollection` has no importer).
- Edit, reorder or re-cover an item (`useUpdateCollectionItem`,
  `useReorderCollectionItems`, `useDeleteCollection`,
  `useDeleteCollectionItem` are interfaces with no body).
- Add an already-published post to a collection, or remove one
  (`removePost` exists, never called). No "Add to collection" in the
  post menu or detail modal.
- See on a post which collection it belongs to.
- See an item's icon: uploaded item icons are written into
  `icon_emoji` as `url:…` and no render path reads them.

## Backend

- Every write is a direct table write; zero RPCs, zero triggers
  (`updated_at` is stale on most paths). Slug uniqueness is a
  client-side read-then-insert loop.
- RLS SELECT is `USING (true)` on all three tables: collections and
  their post links are world-readable regardless of post visibility.
- Uploads go to the root of the public `covers` bucket with
  `upsert: true` and no `{uid}/` folder, so the owner-scoped storage
  policies never match and any signed-in user can overwrite another
  user's collection cover. Files are never deleted.

## Vocabulary

Four nouns for the same level: "piece" (shelf, page), "item" (selector,
item page), "works" and "set" (empty tile). Counts mean different things
on different surfaces.

## Reference the user chose

`/Users/hadi/apartment/quill-studio (1).html`, collections panel:
collections hold works directly ("11 works", "9 words · growing"), the
stack previews the works themselves. The two-level model does not match
the design that was picked.
