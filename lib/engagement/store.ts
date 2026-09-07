/**
 * Engagement store — the ONE place a post's or take's reaction state lives in
 * the tab (docs/engagement/02-plan.md, Phase 1).
 *
 * Every surface (feed card, gallery tile, stream row, detail modal, post
 * page, profile grid, take card …) reads the same entry, so they cannot
 * disagree. Lists seed entries from their rows; writes go through the
 * `set_*_reaction` / `clear_*_reaction` RPCs and the server's answer is
 * written back, so client guesses never become truth.
 *
 * Plain module, no React: the hook lives in `./reactions.ts`.
 */

import { supabase } from "@/lib/supabase";
import type { ReactionType, ReactionCounts } from "@/lib/types";

export type EngagementKind = "post" | "take";

export const REACTION_TYPES: readonly ReactionType[] = [
  "admire",
  "snap",
  "ovation",
  "support",
  "inspired",
  "applaud",
] as const;

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && (REACTION_TYPES as readonly string[]).includes(value);
}

export function emptyReactionCounts(total = 0): ReactionCounts {
  return { admire: 0, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0, total };
}

export interface ReactionEntry {
  /** The viewer's own reaction. Only meaningful when `mineFor === viewerId`. */
  mine: ReactionType | null;
  /** Viewer the `mine` value was loaded for (`null` = anonymous / unknown). */
  mineFor: string | null;
  /** Per-type counts. `total` is trustworthy when `totalLoaded`; the per-type
   *  numbers only when `countsLoaded`. */
  counts: ReactionCounts;
  totalLoaded: boolean;
  countsLoaded: boolean;
  /** A write is in flight — ignore further clicks and stale seeds. */
  pending: boolean;
  /** Last server-confirmed write (ms). Seeds younger than the grace window
   *  after a write are ignored so an in-flight list refetch cannot overwrite
   *  what the server just told us. */
  writtenAt: number;
  /** Comment count over every row (top-level + replies). */
  comments: number;
  commentsLoaded: boolean;
}

export interface ReactionSeed {
  total?: number;
  /** `undefined` = unknown (will be fetched); `null` = known none. */
  mine?: ReactionType | null;
  viewerId?: string | null;
  counts?: ReactionCounts;
  /** Comment count from the list row; undefined = unknown. */
  comments?: number;
}

export interface ReactionWriteResult {
  ok: boolean;
  /** viewer went from no reaction to a reaction */
  added: boolean;
  /** viewer had a reaction and now has a different one */
  changed: boolean;
  /** viewer had a reaction and now has none */
  removed: boolean;
  mine: ReactionType | null;
  error?: unknown;
}

const SEED_GRACE_MS = 5_000;

type Listener = () => void;

const entries = new Map<string, ReactionEntry>();
const listeners = new Map<string, Set<Listener>>();

const DEFAULT_ENTRY: ReactionEntry = Object.freeze({
  mine: null,
  mineFor: null,
  counts: Object.freeze(emptyReactionCounts()) as ReactionCounts,
  totalLoaded: false,
  countsLoaded: false,
  pending: false,
  writtenAt: 0,
  comments: 0,
  commentsLoaded: false,
}) as ReactionEntry;

export function keyFor(kind: EngagementKind, id: string): string {
  return `${kind}:${id}`;
}

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of Array.from(set)) l();
}

function patch(key: string, next: Partial<ReactionEntry>) {
  const prev = entries.get(key) ?? DEFAULT_ENTRY;
  entries.set(key, { ...prev, ...next });
  emit(key);
}

export function getReaction(kind: EngagementKind, id: string): ReactionEntry {
  return entries.get(keyFor(kind, id)) ?? DEFAULT_ENTRY;
}

export function hasReaction(kind: EngagementKind, id: string): boolean {
  return entries.has(keyFor(kind, id));
}

export function subscribeReaction(kind: EngagementKind, id: string, listener: Listener): () => void {
  const key = keyFor(kind, id);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(key);
  };
}

/**
 * Seed an entry from a list row. Safe to call on every render / refetch:
 * it is a no-op while a write is pending or just landed, and it never
 * downgrades known state to unknown.
 */
export function seedReaction(
  kind: EngagementKind,
  id: string,
  seed: ReactionSeed,
  options: { silent?: boolean } = {}
): void {
  const key = keyFor(kind, id);
  const prev = entries.get(key) ?? DEFAULT_ENTRY;
  if (prev.pending) return;
  if (prev.writtenAt && Date.now() - prev.writtenAt < SEED_GRACE_MS) return;

  const next: Partial<ReactionEntry> = {};
  let dirty = !entries.has(key);

  if (seed.counts) {
    if (!countsEqual(prev.counts, seed.counts) || !prev.countsLoaded || !prev.totalLoaded) {
      next.counts = { ...seed.counts };
      next.countsLoaded = true;
      next.totalLoaded = true;
      dirty = true;
    }
  } else if (typeof seed.total === "number") {
    const total = Math.max(0, seed.total);
    if (!prev.totalLoaded || prev.counts.total !== total) {
      // A new total makes any previously loaded per-type split stale.
      next.counts = prev.countsLoaded && prev.counts.total === total ? prev.counts : { ...emptyReactionCounts(total) };
      next.countsLoaded = prev.countsLoaded && prev.counts.total === total;
      next.totalLoaded = true;
      dirty = true;
    }
  }

  if (seed.mine !== undefined) {
    const viewer = seed.viewerId ?? null;
    if (prev.mine !== seed.mine || prev.mineFor !== viewer) {
      next.mine = seed.mine;
      next.mineFor = viewer;
      dirty = true;
    }
  }

  if (typeof seed.comments === "number") {
    const comments = Math.max(0, seed.comments);
    if (!prev.commentsLoaded || prev.comments !== comments) {
      next.comments = comments;
      next.commentsLoaded = true;
      dirty = true;
    }
  }

  if (!dirty) return;
  if (options.silent) {
    // Called during render (first seed): update without notifying other
    // subscribers so React never sees a cross-component update mid-render.
    entries.set(key, { ...prev, ...next });
    return;
  }
  patch(key, next);
}

function countsEqual(a: ReactionCounts, b: ReactionCounts): boolean {
  return (
    a.total === b.total &&
    a.admire === b.admire &&
    a.snap === b.snap &&
    a.ovation === b.ovation &&
    a.support === b.support &&
    a.inspired === b.inspired &&
    a.applaud === b.applaud
  );
}

// ---------------------------------------------------------------------------
// Batched loading through get_<kind>_reaction_summary(uuid[])
// ---------------------------------------------------------------------------

interface SummaryRow {
  id: string;
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
  mine: string | null;
  comments: number;
}

const queues: Record<EngagementKind, Set<string>> = { post: new Set(), take: new Set() };
const flushTimers: Record<EngagementKind, ReturnType<typeof setTimeout> | null> = { post: null, take: null };
const inFlight: Record<EngagementKind, Map<string, Promise<void>>> = { post: new Map(), take: new Map() };
let currentViewer: string | null = null;

/** Called by the hook so batched loads know whose `mine` they return. */
export function setEngagementViewer(viewerId: string | null): void {
  currentViewer = viewerId;
}

function applySummary(kind: EngagementKind, rows: SummaryRow[], viewerId: string | null) {
  for (const row of rows) {
    const key = keyFor(kind, row.id);
    const prev = entries.get(key) ?? DEFAULT_ENTRY;
    if (prev.pending) continue;
    patch(key, {
      counts: {
        admire: row.admire,
        snap: row.snap,
        ovation: row.ovation,
        support: row.support,
        inspired: row.inspired,
        applaud: row.applaud,
        total: row.total,
      },
      countsLoaded: true,
      totalLoaded: true,
      mine: isReactionType(row.mine) ? row.mine : null,
      mineFor: viewerId,
      comments: typeof row.comments === "number" ? row.comments : prev.comments,
      commentsLoaded: typeof row.comments === "number" ? true : prev.commentsLoaded,
    });
  }
}

async function flush(kind: EngagementKind): Promise<void> {
  flushTimers[kind] = null;
  const ids = Array.from(queues[kind]);
  queues[kind].clear();
  if (ids.length === 0) return;
  const viewerId = currentViewer;
  const fn = kind === "post" ? "get_post_reaction_summary" : "get_take_reaction_summary";
  // Chunk to the RPC's 100-id cap.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const promise = (async () => {
      try {
        const { data, error } = await supabase.rpc(fn, { p_ids: chunk });
        if (error) throw error;
        applySummary(kind, (data || []) as SummaryRow[], viewerId);
      } catch (err) {
        console.warn(`[engagement] ${fn} failed:`, err);
      } finally {
        for (const id of chunk) inFlight[kind].delete(id);
      }
    })();
    for (const id of chunk) inFlight[kind].set(id, promise);
  }
}

/** Queue a batched fetch of counts + own reaction; coalesced per tick. */
export function ensureReactionLoaded(kind: EngagementKind, id: string): Promise<void> {
  const existing = inFlight[kind].get(id);
  if (existing) return existing;
  queues[kind].add(id);
  if (!flushTimers[kind]) {
    flushTimers[kind] = setTimeout(() => void flush(kind), 0);
  }
  // Resolve when this id's chunk has been applied.
  return new Promise<void>((resolve) => {
    const check = () => {
      const p = inFlight[kind].get(id);
      if (p) p.finally(resolve);
      else if (queues[kind].has(id)) setTimeout(check, 0);
      else resolve();
    };
    setTimeout(check, 0);
  });
}

/** Does the entry need a fetch for this viewer? */
export function needsReactionLoad(
  entry: ReactionEntry,
  viewerId: string | null,
  wantCounts = false,
  wantComments = false
): boolean {
  if (!entry.totalLoaded) return true;
  if (wantCounts && !entry.countsLoaded) return true;
  if (wantComments && !entry.commentsLoaded) return true;
  if (viewerId && entry.mineFor !== viewerId) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Comment counts — written by useComments after add/delete (server-confirmed)
// ---------------------------------------------------------------------------

/** Server-confirmed comment count for a post/take. */
export function setCommentsCount(kind: EngagementKind, id: string, count: number): void {
  patch(keyFor(kind, id), { comments: Math.max(0, count), commentsLoaded: true });
}

/** Optimistic nudge while a comment write is in flight. */
export function bumpComments(kind: EngagementKind, id: string, delta: number): void {
  const prev = getReaction(kind, id);
  patch(keyFor(kind, id), { comments: Math.max(0, prev.comments + delta) });
}

/**
 * Live counts from a `content-events` broadcast (Phase 5). Server truth, so
 * it overrides loaded counts — but not while this tab has a write in flight
 * or just landed one (the write-back already carries the newer numbers).
 */
export function applyLiveCounts(kind: EngagementKind, id: string, counts: ReactionCounts, comments?: number): void {
  const key = keyFor(kind, id);
  const prev = entries.get(key) ?? DEFAULT_ENTRY;
  if (prev.pending) return;
  if (prev.writtenAt && Date.now() - prev.writtenAt < SEED_GRACE_MS) return;
  const next: Partial<ReactionEntry> = {};
  const total = Math.max(0, Number(counts?.total ?? 0));
  const clean: ReactionCounts = { ...emptyReactionCounts(total) };
  for (const t of REACTION_TYPES) clean[t] = Math.max(0, Number(counts?.[t] ?? 0));
  if (!countsEqual(prev.counts, clean) || !prev.countsLoaded || !prev.totalLoaded) {
    next.counts = clean;
    next.countsLoaded = true;
    next.totalLoaded = true;
  }
  if (typeof comments === "number" && (prev.comments !== comments || !prev.commentsLoaded)) {
    next.comments = Math.max(0, comments);
    next.commentsLoaded = true;
  }
  if (Object.keys(next).length) patch(key, next);
}

// ---------------------------------------------------------------------------
// Writes through set_/clear_<kind>_reaction
// ---------------------------------------------------------------------------

interface RpcResult {
  mine: string | null;
  previous: string | null;
  changed: boolean;
  counts: ReactionCounts;
}

function optimisticCounts(counts: ReactionCounts, prev: ReactionType | null, next: ReactionType | null): ReactionCounts {
  const c = { ...counts };
  if (prev === next) return c;
  if (prev) {
    c[prev] = Math.max(0, c[prev] - 1);
    c.total = Math.max(0, c.total - 1);
  }
  if (next) {
    c[next] = c[next] + 1;
    c.total = c.total + 1;
  }
  return c;
}

async function write(
  kind: EngagementKind,
  id: string,
  viewerId: string,
  next: ReactionType | null
): Promise<ReactionWriteResult> {
  const key = keyFor(kind, id);
  const before = entries.get(key) ?? DEFAULT_ENTRY;
  if (before.pending) {
    return { ok: false, added: false, changed: false, removed: false, mine: before.mine, error: "pending" };
  }
  const prevMine = before.mineFor === viewerId ? before.mine : null;

  // Optimistic: own reaction + counts move immediately.
  patch(key, {
    mine: next,
    mineFor: viewerId,
    counts: optimisticCounts(before.counts, prevMine, next),
    pending: true,
  });

  const fn =
    next === null
      ? kind === "post" ? "clear_post_reaction" : "clear_take_reaction"
      : kind === "post" ? "set_post_reaction" : "set_take_reaction";
  const args =
    next === null
      ? kind === "post" ? { p_post_id: id } : { p_take_id: id }
      : kind === "post" ? { p_post_id: id, p_type: next } : { p_take_id: id, p_type: next };

  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    const result = data as RpcResult;
    const mine = isReactionType(result.mine) ? result.mine : null;
    const previous = isReactionType(result.previous) ? result.previous : null;
    patch(key, {
      mine,
      mineFor: viewerId,
      counts: { ...result.counts },
      countsLoaded: true,
      totalLoaded: true,
      pending: false,
      writtenAt: Date.now(),
    });
    return {
      ok: true,
      mine,
      added: previous === null && mine !== null,
      changed: previous !== null && mine !== null && previous !== mine,
      removed: previous !== null && mine === null,
    };
  } catch (err) {
    console.error(`[engagement] ${fn} failed:`, err);
    // Revert to what we had before the click.
    patch(key, {
      mine: before.mine,
      mineFor: before.mineFor,
      counts: before.counts,
      countsLoaded: before.countsLoaded,
      totalLoaded: before.totalLoaded,
      pending: false,
    });
    return { ok: false, added: false, changed: false, removed: false, mine: before.mine, error: err };
  }
}

export function setReaction(kind: EngagementKind, id: string, viewerId: string, type: ReactionType) {
  return write(kind, id, viewerId, type);
}

export function clearReaction(kind: EngagementKind, id: string, viewerId: string) {
  return write(kind, id, viewerId, null);
}

/** Same type again = remove; otherwise set. */
export function toggleReaction(kind: EngagementKind, id: string, viewerId: string, type: ReactionType) {
  const entry = getReaction(kind, id);
  const mine = entry.mineFor === viewerId ? entry.mine : null;
  return mine === type ? clearReaction(kind, id, viewerId) : setReaction(kind, id, viewerId, type);
}

/** Heart button / double-tap: any reaction → remove; none → admire. */
export function toggleDefaultReaction(kind: EngagementKind, id: string, viewerId: string) {
  const entry = getReaction(kind, id);
  const mine = entry.mineFor === viewerId ? entry.mine : null;
  return mine ? clearReaction(kind, id, viewerId) : setReaction(kind, id, viewerId, "admire");
}

/** Force a fresh read (poll-on-focus). */
export function refreshReaction(kind: EngagementKind, id: string): Promise<void> {
  return ensureReactionLoaded(kind, id);
}

/** Test helper. */
export function __resetEngagementStore(): void {
  entries.clear();
  listeners.clear();
  for (const kind of ["post", "take"] as EngagementKind[]) {
    queues[kind].clear();
    inFlight[kind].clear();
    if (flushTimers[kind]) clearTimeout(flushTimers[kind]!);
    flushTimers[kind] = null;
  }
  currentViewer = null;
}
