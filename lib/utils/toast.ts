import { toast } from "sonner";

/**
 * Toast notification utilities for consistent user feedback
 * Use these instead of console.log/console.error for user-facing operations
 */

export const showToast = {
  /**
   * Show success message
   */
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3000,
    });
  },

  /**
   * Show error message
   */
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    });
  },

  /**
   * Show info message
   */
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Show warning message
   */
  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Show loading toast that can be updated
   * Returns a function to dismiss the toast
   */
  loading: (message: string) => {
    const id = toast.loading(message);
    return {
      dismiss: () => toast.dismiss(id),
      success: (msg: string) => toast.success(msg, { id }),
      error: (msg: string) => toast.error(msg, { id }),
    };
  },

  /**
   * Show promise toast - automatically handles loading, success, and error states
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

// Specific action toasts for common operations
export const actionToast = {
  // Post actions
  postDeleted: () => showToast.success("Post deleted"),
  postDeleteError: () => showToast.error("Failed to delete post", "Please try again"),
  postSaved: () => showToast.success("Post saved to bookmarks"),
  postUnsaved: () => showToast.info("Removed from bookmarks"),
  postSaveError: () => showToast.error("Failed to save post", "Please try again"),
  postRelayed: () => showToast.success("Post relayed to your followers"),
  postUnrelayed: () => showToast.info("Relay removed"),
  postRelayError: () => showToast.error("Failed to relay post", "Please try again"),

  // Reaction actions
  reactionError: () => showToast.error("Failed to react", "Please try again"),

  // Follow actions
  followed: (username: string) => showToast.success(`Following ${username}`),
  unfollowed: (username: string) => showToast.info(`Unfollowed ${username}`),
  followRequestSent: () => showToast.success("Follow request sent"),
  followError: () => showToast.error("Failed to follow", "Please try again"),
  unfollowError: () => showToast.error("Failed to unfollow", "Please try again"),

  // Block actions
  userBlocked: (username: string) => showToast.success(`Blocked ${username}`),
  userUnblocked: (username: string) => showToast.info(`Unblocked ${username}`),
  blockError: () => showToast.error("Failed to block user", "Please try again"),
  unblockError: () => showToast.error("Failed to unblock user", "Please try again"),

  // Report actions
  reportSubmitted: () => showToast.success("Report submitted", "We'll review this shortly"),
  reportError: () => showToast.error("Failed to submit report", "Please try again"),

  // Comment actions
  commentAdded: () => showToast.success("Comment added"),
  commentDeleted: () => showToast.success("Comment deleted"),
  commentError: () => showToast.error("Failed to add comment", "Please try again"),

  // Generic errors
  genericError: (action?: string) => showToast.error(
    action ? `Failed to ${action}` : "Something went wrong",
    "Please try again"
  ),

  // Network errors
  networkError: () => showToast.error("Connection failed", "Check your internet and try again"),

  // Community membership actions — map RPC error codes to user-friendly toasts.
  invitationSent: (username?: string) =>
    showToast.success(username ? `Invited @${username}` : "Invitation sent"),
  invitationAccepted: (community?: string) =>
    showToast.success(community ? `Joined ${community}` : "Invitation accepted"),
  invitationDeclined: () => showToast.info("Invitation declined"),
  joinRequestSent: () => showToast.success("Request sent", "An admin will review it soon"),
  joinedCommunity: (community?: string) =>
    showToast.success(community ? `Joined ${community}` : "Joined community"),
  joinRequestApproved: () => showToast.success("Request approved"),
  joinRequestRejected: () => showToast.info("Request rejected"),
  membershipError: (code?: string) => {
    const map: Record<string, [string, string?]> = {
      not_authenticated: ["Please sign in", "You need an account to do that"],
      not_a_member: ["You're not a member", "Join the community first to invite others"],
      cannot_invite_self: ["You can't invite yourself"],
      already_member: ["Already a member"],
      invitee_banned: ["Can't invite", "This user is banned from the community"],
      banned: ["You're banned from this community"],
      already_responded: ["Already responded to this invitation"],
      not_invitee: ["This invitation isn't for you"],
      invitation_not_found: ["Invitation not found", "It may have been revoked"],
      request_not_found: ["Request not found"],
      not_authorized: ["Not allowed", "Only admins or moderators can do this"],
      already_reviewed: ["Already reviewed"],
    };
    const [title, detail] = map[code || ""] || ["Something went wrong", "Please try again"];
    showToast.error(title, detail);
  },
};

export default showToast;
