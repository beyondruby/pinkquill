"use client";

/**
 * CommentComposer — the one comment input for posts, takes and replies
 * (docs/engagement/02-plan.md, Phase 6).
 *
 * - Auto-growing textarea; Enter sends, Shift+Enter is a newline, IME
 *   composition never sends.
 * - Counter from 2,000 of the 2,200 limit; over the limit blocks sending.
 * - Emoji button (the existing EmojiPicker), inserted at the caret.
 * - "Replying to @name ×" chip when `replyingTo` is set.
 * - `@` autocomplete through `search_mention_candidates` (people you follow
 *   first, blocked and non-following private accounts excluded) and `#`
 *   autocomplete from the tags table. Arrow keys move, Enter/Tab pick,
 *   Escape closes.
 * The owner keeps the text in state so a failed post can be retried.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { COMMENT_MAX_LENGTH } from "@/lib/hooks/useComments";
import { sanitizePostgrestSearchTerm } from "@/lib/utils/postgrest";
import EmojiPicker from "@/components/ui/EmojiPicker";
import { Spinner } from "@/components/ui/Loading";

export const COMMENT_COUNTER_FROM = 2000;

interface Candidate {
  key: string;
  label: string;
  sub?: string;
  avatar?: string | null;
  insert: string;
}

interface Token {
  trigger: "@" | "#";
  query: string;
  start: number;
  end: number;
}

/** The `@name` / `#tag` token the caret is inside, if any. */
export function tokenAtCaret(value: string, caret: number): Token | null {
  const before = value.slice(0, caret);
  const m = /(^|[\s(])([@#])(\w{0,30})$/.exec(before);
  if (!m) return null;
  const query = m[3];
  return { trigger: m[2] as "@" | "#", query, start: caret - query.length - 1, end: caret };
}

export interface CommentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<unknown>;
  submitting?: boolean;
  disabled?: boolean;
  placeholder?: string;
  avatarUrl?: string | null;
  /** Show the viewer's avatar on the left (top-level composer). */
  showAvatar?: boolean;
  autoFocus?: boolean;
  /** "Replying to @name ×" chip. */
  replyingTo?: { username: string } | null;
  onCancelReply?: () => void;
  /** `sm` is the inline reply variant. */
  size?: "md" | "sm";
  maxLength?: number;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  submitLabel?: string;
}

const DEFAULT_AVATAR = "/defaultprofile.png";

export default function CommentComposer({
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
  placeholder = "Add to the conversation…",
  avatarUrl,
  showAvatar = false,
  autoFocus = false,
  replyingTo = null,
  onCancelReply,
  size = "md",
  maxLength = COMMENT_MAX_LENGTH,
  className = "",
  textareaRef,
  submitLabel = "Post comment",
}: CommentComposerProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (textareaRef) (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    },
    [textareaRef]
  );
  const [caret, setCaret] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acLoading, setAcLoading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);

  const length = value.length;
  const over = length > maxLength;
  const canSend = value.trim().length > 0 && !over && !submitting && !disabled;

  const token = useMemo(() => tokenAtCaret(value, caret), [value, caret]);
  const tokenKey = token ? `${token.trigger}${token.query}@${token.start}` : null;
  const acOpen = !!token && candidates.length > 0 && dismissedToken !== tokenKey;

  // Auto-grow up to ~6 lines.
  useEffect(() => {
    const ta = innerRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, size === "sm" ? 120 : 160)}px`;
  }, [value, size]);

  // Autocomplete lookups, debounced; stale answers are dropped.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!token) {
      setCandidates([]);
      setAcIndex(0);
      setAcLoading(false);
      return;
    }
    let cancelled = false;
    setAcLoading(true);
    const timer = setTimeout(async () => {
      try {
        let next: Candidate[] = [];
        if (token.trigger === "@") {
          const { data, error } = await supabase.rpc("search_mention_candidates", { p_query: token.query, p_limit: 8 });
          if (error) throw error;
          next = ((data || []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>).map((u) => ({
            key: u.id,
            label: u.display_name || u.username,
            sub: `@${u.username}`,
            avatar: u.avatar_url,
            insert: `@${u.username} `,
          }));
        } else if (token.query) {
          const q = sanitizePostgrestSearchTerm(token.query.toLowerCase());
          if (q) {
            const { data, error } = await supabase.from("tags").select("name").ilike("name", `${q}%`).limit(8);
            if (error) throw error;
            next = ((data || []) as Array<{ name: string }>).map((t) => ({ key: t.name, label: `#${t.name}`, insert: `#${t.name} ` }));
          }
        }
        if (!cancelled) {
          setCandidates(next);
          setAcIndex(0);
        }
      } catch (err) {
        console.warn("[CommentComposer] autocomplete failed:", err);
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setAcLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the token's text
  }, [token?.trigger, token?.query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const syncCaret = () => {
    const ta = innerRef.current;
    if (ta) setCaret(ta.selectionStart ?? ta.value.length);
  };

  const insertAtCaret = useCallback(
    (text: string, replaceFrom?: number, replaceTo?: number) => {
      const ta = innerRef.current;
      const from = replaceFrom ?? ta?.selectionStart ?? value.length;
      const to = replaceTo ?? ta?.selectionEnd ?? from;
      const next = value.slice(0, from) + text + value.slice(to);
      onChange(next);
      const pos = from + text.length;
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      });
    },
    [value, onChange]
  );

  const pick = (c: Candidate) => {
    if (!token) return;
    insertAtCaret(c.insert, token.start, token.end);
    setCandidates([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcIndex((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcIndex((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (!e.nativeEvent.isComposing) {
          e.preventDefault();
          pick(candidates[acIndex] ?? candidates[0]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedToken(tokenKey);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) void onSubmit();
    }
  };

  const avatar = showAvatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl || DEFAULT_AVATAR}
      alt="You"
      className={`rounded-full object-cover flex-shrink-0 ${size === "sm" ? "w-7 h-7" : "w-9 h-9"}`}
    />
  ) : null;

  return (
    <div className={`flex gap-2.5 items-end ${className}`}>
      {avatar}
      <div className="flex-1 min-w-0 relative">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-1.5 font-ui text-[0.72rem] text-muted">
            <span>
              Replying to <span className="text-purple-primary font-medium">@{replyingTo.username}</span>
            </span>
            {onCancelReply && (
              <button
                type="button"
                onClick={onCancelReply}
                aria-label={`Stop replying to @${replyingTo.username}`}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-skeleton text-muted/70"
              >
                ×
              </button>
            )}
          </div>
        )}

        <div
          className={`relative flex items-end gap-1 bg-subtle focus-within:bg-surface focus-within:ring-2 focus-within:ring-purple-primary/30 transition-all ${
            size === "sm" ? "rounded-2xl px-3 py-1" : "rounded-3xl px-4 py-1.5"
          } ${over ? "ring-2 ring-red-400/60" : ""}`}
        >
          <textarea
            ref={setRefs}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              if (dismissedToken) setDismissedToken(null);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            onSelect={syncCaret}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-label={placeholder}
            aria-autocomplete="list"
            aria-expanded={acOpen}
            aria-controls={acOpen ? "comment-autocomplete" : undefined}
            className={`flex-1 min-w-0 resize-none border-none bg-transparent outline-none font-body text-ink placeholder:text-muted/60 leading-relaxed ${
              size === "sm" ? "py-1.5 text-[0.85rem]" : "py-2 text-[0.92rem]"
            }`}
          />
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            disabled={disabled}
            aria-label="Add emoji"
            aria-pressed={emojiOpen}
            className={`flex-shrink-0 rounded-full flex items-center justify-center text-muted hover:text-accent transition-colors ${
              size === "sm" ? "w-7 h-7 mb-0.5" : "w-8 h-8 mb-1"
            }`}
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 10h.01M15 10h.01" />
            </svg>
          </button>
        </div>

        {length >= COMMENT_COUNTER_FROM && (
          <div className={`mt-1 mr-2 text-right font-ui text-[0.7rem] tabular-nums ${over ? "text-red-500" : "text-muted"}`} aria-live="polite">
            {length.toLocaleString()}/{maxLength.toLocaleString()}
          </div>
        )}

        {acOpen && (
          <ul
            id="comment-autocomplete"
            role="listbox"
            className="absolute left-0 right-0 bottom-full mb-2 z-40 bg-surface rounded-2xl shadow-xl border border-border-light overflow-hidden max-h-64 overflow-y-auto"
          >
            {candidates.map((c, i) => (
              <li
                key={c.key}
                role="option"
                aria-selected={i === acIndex}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep the textarea focused
                  pick(c);
                }}
                onMouseEnter={() => setAcIndex(i)}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${i === acIndex ? "bg-purple-primary/8" : ""}`}
              >
                {c.avatar !== undefined ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar || DEFAULT_AVATAR} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center text-purple-primary font-ui text-sm flex-shrink-0">#</span>
                )}
                <span className="min-w-0">
                  <span className="block font-ui text-[0.85rem] text-ink truncate">{c.label}</span>
                  {c.sub && <span className="block font-ui text-[0.72rem] text-muted truncate">{c.sub}</span>}
                </span>
              </li>
            ))}
            {acLoading && (
              <li className="px-3 py-2 flex items-center gap-2 text-muted font-ui text-[0.75rem]">
                <Spinner size="xs" /> Searching…
              </li>
            )}
          </ul>
        )}

        {/* Rendered in a portal beside the button so scrolling lists and modals never clip it */}
        {emojiOpen && (
          <EmojiPicker
            isOpen={emojiOpen}
            anchorRef={emojiButtonRef}
            onClose={() => setEmojiOpen(false)}
            onSelect={(emoji) => {
              insertAtCaret(emoji);
              setEmojiOpen(false);
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={!canSend}
        aria-label={submitLabel}
        className={`flex-shrink-0 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 ${
          size === "sm" ? "w-9 h-9 mb-0.5" : "w-10 h-10 mb-0.5"
        }`}
      >
        {submitting ? (
          <Spinner size="xs" className="text-white" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </div>
  );
}
