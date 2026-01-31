import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Post, SharedPostPreview } from "@/lib/types";

interface ShareToDMResult {
  success: boolean;
  conversationId?: string;
  error?: string;
}

interface UseShareToDMReturn {
  sharePostToDM: (
    post: Post,
    recipientIds: string[],
    currentUserId: string,
    optionalMessage?: string
  ) => Promise<ShareToDMResult[]>;
  sharing: boolean;
  progress: { current: number; total: number };
}

/**
 * Hook for sharing posts via DM
 * Handles finding/creating conversations and sending post share messages
 */
export function useShareToDM(): UseShareToDMReturn {
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /**
   * Find existing conversation between two users
   */
  const findExistingConversation = async (
    userId1: string,
    userId2: string
  ): Promise<string | null> => {
    // Get all conversations for user1
    const { data: user1Convos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId1);

    if (!user1Convos || user1Convos.length === 0) return null;

    const conversationIds = user1Convos.map((c) => c.conversation_id);

    // Check if user2 is in any of those conversations
    const { data: sharedConvo } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId2)
      .in("conversation_id", conversationIds)
      .limit(1)
      .single();

    return sharedConvo?.conversation_id || null;
  };

  /**
   * Create a new conversation between two users
   */
  const createConversation = async (
    userId1: string,
    userId2: string
  ): Promise<string | null> => {
    // Create the conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({ updated_at: new Date().toISOString() })
      .select()
      .single();

    if (convError || !conversation) {
      console.error("Failed to create conversation:", convError);
      return null;
    }

    // Add both participants
    const { error: participantError } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: conversation.id, user_id: userId1 },
        { conversation_id: conversation.id, user_id: userId2 },
      ]);

    if (participantError) {
      console.error("Failed to add participants:", participantError);
      // Clean up the conversation
      await supabase.from("conversations").delete().eq("id", conversation.id);
      return null;
    }

    return conversation.id;
  };

  /**
   * Send a post share message to a conversation
   */
  const sendPostShareMessage = async (
    conversationId: string,
    senderId: string,
    postId: string,
    optionalMessage?: string
  ): Promise<boolean> => {
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: optionalMessage || "",
      message_type: "post_share",
      shared_post_id: postId,
    });

    if (error) {
      console.error("Failed to send post share message:", error);
      return false;
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return true;
  };

  /**
   * Share a post to multiple recipients via DM
   */
  const sharePostToDM = useCallback(
    async (
      post: Post,
      recipientIds: string[],
      currentUserId: string,
      optionalMessage?: string
    ): Promise<ShareToDMResult[]> => {
      if (recipientIds.length === 0) {
        return [];
      }

      setSharing(true);
      setProgress({ current: 0, total: recipientIds.length });

      const results: ShareToDMResult[] = [];

      for (let i = 0; i < recipientIds.length; i++) {
        const recipientId = recipientIds[i];
        setProgress({ current: i + 1, total: recipientIds.length });

        try {
          // Find or create conversation
          let conversationId = await findExistingConversation(
            currentUserId,
            recipientId
          );

          if (!conversationId) {
            conversationId = await createConversation(currentUserId, recipientId);
          }

          if (!conversationId) {
            results.push({
              success: false,
              error: "Failed to create conversation",
            });
            continue;
          }

          // Send the post share message
          const success = await sendPostShareMessage(
            conversationId,
            currentUserId,
            post.id,
            optionalMessage
          );

          results.push({
            success,
            conversationId: success ? conversationId : undefined,
            error: success ? undefined : "Failed to send message",
          });
        } catch (error) {
          console.error("Error sharing to recipient:", error);
          results.push({
            success: false,
            error: "An unexpected error occurred",
          });
        }
      }

      setSharing(false);
      setProgress({ current: 0, total: 0 });

      return results;
    },
    []
  );

  return {
    sharePostToDM,
    sharing,
    progress,
  };
}

/**
 * Fetch shared post preview data for a message
 */
export async function fetchSharedPostPreview(
  postId: string
): Promise<SharedPostPreview | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      type,
      title,
      content,
      created_at,
      author:profiles!posts_author_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      ),
      media:post_media (
        media_url,
        media_type
      )
    `
    )
    .eq("id", postId)
    .single();

  if (error || !data) {
    console.error("Failed to fetch shared post:", error);
    return null;
  }

  const author = data.author as unknown as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };

  const media = (data.media as unknown as { media_url: string; media_type: "image" | "video" }[]) || [];

  return {
    id: data.id,
    type: data.type,
    title: data.title,
    content: data.content,
    created_at: data.created_at,
    author: {
      id: author.id,
      username: author.username,
      display_name: author.display_name,
      avatar_url: author.avatar_url,
    },
    media: media.length > 0 ? media[0] : null,
  };
}
