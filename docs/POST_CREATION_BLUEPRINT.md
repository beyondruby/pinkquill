# Post Creation Blueprint — "Creative Formats"

Status: **Proposed / awaiting approval.** Author: revamp of the post creation + feed
showcase system so Pinkquill serves *all* creatives (writers, visual artists,
photographers, musicians, filmmakers) equally — not just writers.

Guiding rule from the product owner: **reorganize + add, never remove.** Every
format and every option that exists today is preserved; it just gets a clearer
home, plus **Sound** becomes a real, uploadable medium.

---

## 1. Vocabulary

- **Format** — what the creator made: Thought, Poem, Journal, Essay, Blog, Story,
  Letter, Quote, Visual, Video, Audio, Sound, Voice. (Stored in `posts.type`.)
- **Category** — how a format is *experienced*, the 4 human-facing groups:
  **Read · Seen · Watched · Heard**. Derived in code from the format (not stored).
- **Medium** — what content a post technically contains (text / image / video /
  audio). Multi-valued, derived from the post's content + attachments. Used for
  filtering/discovery only.

The post's **Format is the single source of truth** for its name, its creation
options, and its feed showcase. A post has **exactly one Format** (defaults to
**Thought**), but may contain **multiple media**.

---

## 2. The two-page wizard

Modeled on the existing product/commission creation wizards (`Next / Back`).

### Page 1 — Create  *(universal, Instagram-like, required)*

The open canvas. Works the same whether you're a writer or a visual artist.

| Field | Status | Notes |
|---|---|---|
| Title | KEPT | optional |
| Body / writing area | KEPT | first-class & prominent (writers' content, not a "caption") |
| Media: image / video upload | KEPT | gallery, ordered, per-item caption |
| **Audio / sound upload** | **NEW** | the net-new medium (see §8) |
| Text styling | KEPT | alignment, line spacing, **drop-cap**, **background picker** — stays here, with the writing, shown live |
| → **Next** | | proceeds to Page 2 |

### Page 2 — Format  *(optional)*

Four categories shown, **no pre-selection**. The creator freely picks a format;
selecting one reveals that format's extra options. Skipping the page entirely →
the post is a **Thought**.

Also on this page (shared, KEPT): audience/visibility, tags, community + flair,
content warning, collaborators, tagged people, location. **Preview + Post.**

---

## 3. Categories & Formats  (full map — nothing removed)

| Category | Formats | Status |
|---|---|---|
| 📖 **Read** (text) | Thought · Poem · Journal · Essay · Blog · Story · Letter · Quote | all KEPT |
| 👁 **Seen** (image) | Visual | KEPT |
| ▶ **Watched** (video) | Video | KEPT |
| 🎧 **Heard** (sound) | Audio (Spotify link) · **Sound (uploaded audio)** · Voice | Audio KEPT · Sound/Voice NEW |

> Note: Story, Letter, Quote, Visual, Audio, Video exist as types today but were
> *not* offered in the composer. This blueprint makes them creatable again — an
> expansion, consistent with "don't remove."

---

## 4. Per-format options (preserve all existing; NEW marked)

Shared by every format: title, body, media, styling (Page 1); audience, tags,
community+flair, content warning, collaborators, tagged people, location (Page 2).

| Format | Format-specific options |
|---|---|
| **Thought** *(default)* | none — just text |
| **Poem** | centered/typography (via Page-1 styling) · *form tag: free verse / haiku / sonnet* (NEW, optional) |
| **Journal** | **mood · weather · entry date** (KEPT — `JournalMetadata`) |
| **Essay** | *subtitle* (NEW, optional) · auto reading-time (showcase) |
| **Blog** | *subtitle* (NEW, optional) · auto reading-time (showcase) |
| **Story** | *part/chapter label* (NEW, optional, later) |
| **Letter** | *addressed to* (NEW, optional, later) |
| **Quote** | *attribution / source* (NEW, optional) |
| **Visual** | image gallery + per-image caption/alt (KEPT) |
| **Video** | video + poster/thumbnail (KEPT) · auto runtime badge |
| **Audio** | Spotify link (KEPT — `spotify_track`) |
| **Sound** (NEW) | uploaded audio file · cover art · optional track title |
| **Voice** (NEW) | uploaded voice note (short) · *transcript* (optional, later) |

NEW optional metadata fields are clearly marked; only **Sound/Voice upload** is a
required new build. Everything else is reorganization of what exists.

---

## 5. Defaults & rules

1. **No format chosen → Thought.** A Thought may still carry media (e.g. a quick
   photo with a line of text remains a Thought unless the creator picks Visual).
2. **One Format per post; media is multi.** The Format decides the *primary
   showcase*; any additional media rides along as a secondary element.
3. **Format is never required** — a post can always be published from Page 1.
4. **Takes (short vertical reels) stay a separate creator** — this wizard is for
   feed posts only.

---

## 6. Feed showcases (display per format)

Base = the unified "calm" card system (neutral canvas, one accent, content-driven
size — already shipped in `AlternateCards.tsx`). Each format adds a tasteful
showcase **driven by function, not decoration**:

| Category / Format | Showcase |
|---|---|
| Read · Thought | simple text line |
| Read · Poem | centered, typographic, quiet |
| Read · Journal | dated entry w/ mood/weather chips |
| Read · Essay/Blog | editorial card, cover + "6 min read" |
| Read · Story/Letter/Quote | editorial / pull-quote treatments (existing) |
| Seen · Visual | full-bleed image, swipeable gallery; captions/EXIF on detail |
| Watched · Video | cinematic 16:9 hero, play + runtime badge |
| Heard · Audio | Spotify embed/card (existing) |
| Heard · **Sound** | album-art card with **inline play + progress bar** |
| Heard · **Voice** | compact voice card with play + duration |

Detail view (`PostDetailModal` / post page) shows the full experience (full
gallery + EXIF, full track + lyrics later, etc.).

---

## 7. Discovery / filters

Feed + profile + explore filter bar: **All · Read · Seen · Watched · Heard**.
Because Medium is multi, a post appears under every category whose medium it
contains (an illustration + voice note shows under both Seen and Heard). The
post's *Format* category is its "home"; additional media broaden where it surfaces.

---

## 8. Data model & storage

- **`posts.type`** continues to hold the **Format id** (no DB constraint exists
  today; ~32 rows). Allowed values expand to the full set incl. `sound`, `voice`.
  Default `thought`.
- **Category** is derived in code from format (no new column).
- **Sound/Voice storage (NEW):**
  - Extend `post_media.media_type` to allow `'audio'` (today: image|video). An
    audio item carries `media_url` (the uploaded file) + optional cover via the
    existing media fields.
  - Storage: a private/public `post-audio` bucket (or reuse the existing `sounds`
    bucket used by Takes) with size/duration limits.
  - `spotify_track` (existing) remains for the Audio (link) format.
- **Medium flags** for filtering derived from `post_media` + body presence
  (no schema change required; optionally denormalize later for performance).

---

## 9. Architecture — the Format Registry (so it stays systematic, not random)

A single declarative registry is the spine. Each format is one blueprint:

```ts
interface FormatSpec {
  id: PostType;              // 'poem' | 'sound' | ...
  label: string;            // canonical name (single source of truth)
  category: 'read' | 'seen' | 'watched' | 'heard';
  leadMedium: 'text' | 'image' | 'video' | 'audio';
  options: ComposerModule[];   // which Page-2 tools it unlocks
  showcase: ShowcaseId;        // how the feed card renders it
}
```

- The **composer (Page 2)** renders whatever `options` the chosen format declares.
- The **feed** renders the format's `showcase`.
- **Terminology** comes only from `label` — extends the existing
  `lib/feed-view/post-type-theme.ts` (already the source of truth after the
  layout revamp). No more divergent label maps.
- Adding a future format (Recipe, Tattoo, 3D…) = adding one blueprint; the
  composer and feed already know how to render it.

---

## 10. Backward compatibility

- Existing posts keep their `type`; each maps cleanly into a category
  (writing→Read, visual→Seen, video→Watched, audio→Heard). No data migration
  required beyond optionally seeding the new bucket/`media_type`.
- The classic feed layout is untouched; the alternate layouts already read from
  the canonical theme.

---

## 11. Build phases

1. **Wizard shell + Page 1** — refactor `CreatePost.tsx` into the 2-page wizard;
   move styling to Page 1; keep all current inputs working.
2. **Page 2** — categories (Read/Seen/Watched/Heard) + format pick + per-format
   options (wire existing journal/spotify/etc.); default→Thought.
3. **Sound feature** — audio upload + storage + `post_media` audio support +
   player component + Sound/Voice showcases.
4. **Format Registry refactor** — formalize the blueprint registry; point
   composer + feed at it; align filters to the 4 categories.

Each phase is independently shippable and verifiable in the running app.

---

## 12. Open decisions (to confirm)

- Sound limits: max duration / file size / formats (mp3, m4a, wav?).
- Reuse `sounds` bucket vs. new `post-audio` bucket.
- Whether the NEW optional metadata fields (poem form, essay subtitle, quote
  attribution) ship now or later — default: later, keep Phase 1–3 to
  restructure + Sound.
