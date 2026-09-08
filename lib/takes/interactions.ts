import { supabase } from "@/lib/supabase";

/**
 * The one write path for saving / relaying a take (profile audit 2f, V-52:
 * the feed hook, the post card, the modal and the page each inlined these
 * inserts and deletes). Throws on a database error so callers can revert.
 */
export async function setTakeSaved(takeId: string, userId: string, saved: boolean): Promise<void> {
  const { error } = saved
    ? await supabase.from("take_saves").insert({ take_id: takeId, user_id: userId })
    : await supabase.from("take_saves").delete().eq("take_id", takeId).eq("user_id", userId);
  if (error) throw error;
}

/** The take_relays trigger notifies the author. */
export async function setTakeRelayed(takeId: string, userId: string, relayed: boolean): Promise<void> {
  const { error } = relayed
    ? await supabase.from("take_relays").insert({ take_id: takeId, user_id: userId })
    : await supabase.from("take_relays").delete().eq("take_id", takeId).eq("user_id", userId);
  if (error) throw error;
}
