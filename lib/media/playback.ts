// One piece of media plays at a time, across every player (finding F-33).
//
// VideoPlayer, AudioPlayer and TakePlayer each used to keep their own
// "pause the others" registry, so a feed video kept playing under an audio
// post and vice versa. Every player now announces on play and pauses when
// any other player announces. Ids come from React's `useId`.

const PLAYBACK_EVENT = "pq-media-play";

export function announcePlayback(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(PLAYBACK_EVENT, { detail: id }));
}

/** Calls `pause` whenever a player other than `id` starts. Returns the unsubscribe. */
export function onOtherPlayback(id: string, pause: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    if ((e as CustomEvent<string>).detail !== id) pause();
  };
  window.addEventListener(PLAYBACK_EVENT, handler);
  return () => window.removeEventListener(PLAYBACK_EVENT, handler);
}
