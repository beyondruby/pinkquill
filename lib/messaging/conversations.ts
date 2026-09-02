import { supabase } from "@/lib/supabase";

/**
 * Find the DM conversation between the current user and `otherUserId`, or
 * create it. Atomic on the server (`get_or_create_dm_conversation`): checks
 * auth, blocks, existence, and serialises concurrent creation for the pair.
 * Replaces four client-side implementations (findings C4/L9).
 */
export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_dm_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error) {
    throw new Error(error.message || "Could not open a conversation");
  }
  if (typeof data !== "string" || !data) {
    throw new Error("Could not open a conversation");
  }
  return data;
}
