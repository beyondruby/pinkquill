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
  postRelayed: () => showToast.success("Post relayed to your followers"),
  postUnrelayed: () => showToast.info("Relay removed"),

  // Reaction actions
  reactionAdded: (type: string) => showToast.success(`You ${type === 'admire' ? 'admired' : type + 'd'} this post`),
  reactionRemoved: () => showToast.info("Reaction removed"),

  // Follow actions
  followed: (username: string) => showToast.success(`Following ${username}`),
  unfollowed: (username: string) => showToast.info(`Unfollowed ${username}`),
  followRequested: (username: string) => showToast.success(`Follow request sent to ${username}`),
  followRequestAccepted: () => showToast.success("Follow request accepted"),
  followRequestDeclined: () => showToast.info("Follow request declined"),

  // Block actions
  userBlocked: (username: string) => showToast.success(`Blocked ${username}`),
  userUnblocked: (username: string) => showToast.info(`Unblocked ${username}`),
  blockError: () => showToast.error("Failed to block user", "Please try again"),

  // Comment actions
  commentAdded: () => showToast.success("Comment posted"),
  commentDeleted: () => showToast.success("Comment deleted"),
  commentError: () => showToast.error("Failed to post comment", "Please try again"),

  // Report actions
  reportSubmitted: () => showToast.success("Report submitted", "We'll review this shortly"),
  reportError: () => showToast.error("Failed to submit report", "Please try again"),

  // Generic errors
  networkError: () => showToast.error("Connection error", "Please check your internet connection"),
  genericError: (action?: string) => showToast.error(
    action ? `Failed to ${action}` : "Something went wrong",
    "Please try again"
  ),

  // Auth
  signedOut: () => showToast.info("Signed out successfully"),
  sessionExpired: () => showToast.warning("Session expired", "Please sign in again"),

  // Clipboard
  copied: (item?: string) => showToast.success(item ? `${item} copied to clipboard` : "Copied to clipboard"),
  copyError: () => showToast.error("Failed to copy to clipboard"),
};

export default showToast;
