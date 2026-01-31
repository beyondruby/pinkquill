import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { showToast, actionToast } from "../toast";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
}));

describe("showToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call toast.success with message and duration", () => {
    showToast.success("Success message");
    expect(toast.success).toHaveBeenCalledWith("Success message", {
      description: undefined,
      duration: 3000,
    });
  });

  it("should call toast.success with message and description", () => {
    showToast.success("Success", "Description");
    expect(toast.success).toHaveBeenCalledWith("Success", {
      description: "Description",
      duration: 3000,
    });
  });

  it("should call toast.error with message and duration", () => {
    showToast.error("Error message");
    expect(toast.error).toHaveBeenCalledWith("Error message", {
      description: undefined,
      duration: 5000,
    });
  });

  it("should call toast.error with message and description", () => {
    showToast.error("Error", "Details");
    expect(toast.error).toHaveBeenCalledWith("Error", {
      description: "Details",
      duration: 5000,
    });
  });

  it("should call toast.info with message and duration", () => {
    showToast.info("Info message");
    expect(toast.info).toHaveBeenCalledWith("Info message", {
      description: undefined,
      duration: 4000,
    });
  });

  it("should call toast.warning with message and duration", () => {
    showToast.warning("Warning message");
    expect(toast.warning).toHaveBeenCalledWith("Warning message", {
      description: undefined,
      duration: 4000,
    });
  });

  it("should call toast.loading and return control functions", () => {
    const result = showToast.loading("Loading...");
    expect(toast.loading).toHaveBeenCalledWith("Loading...");
    expect(result).toHaveProperty("dismiss");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("error");
  });

  it("should dismiss loading toast", () => {
    const result = showToast.loading("Loading...");
    result.dismiss();
    expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
  });
});

describe("actionToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("post actions", () => {
    it("should show success toast for post deleted", () => {
      actionToast.postDeleted();
      expect(toast.success).toHaveBeenCalledWith("Post deleted", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show error toast for post delete error", () => {
      actionToast.postDeleteError();
      expect(toast.error).toHaveBeenCalledWith("Failed to delete post", {
        description: "Please try again",
        duration: 5000,
      });
    });

    it("should show success toast for post saved", () => {
      actionToast.postSaved();
      expect(toast.success).toHaveBeenCalledWith("Post saved to bookmarks", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show info toast for post unsaved", () => {
      actionToast.postUnsaved();
      expect(toast.info).toHaveBeenCalledWith("Removed from bookmarks", {
        description: undefined,
        duration: 4000,
      });
    });

    it("should show success toast for post relayed", () => {
      actionToast.postRelayed();
      expect(toast.success).toHaveBeenCalledWith("Post relayed to your followers", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show info toast for post unrelayed", () => {
      actionToast.postUnrelayed();
      expect(toast.info).toHaveBeenCalledWith("Relay removed", {
        description: undefined,
        duration: 4000,
      });
    });
  });

  describe("user actions", () => {
    it("should show success toast for user blocked with username", () => {
      actionToast.userBlocked("testuser");
      expect(toast.success).toHaveBeenCalledWith("Blocked testuser", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show error toast for block error", () => {
      actionToast.blockError();
      expect(toast.error).toHaveBeenCalledWith("Failed to block user", {
        description: "Please try again",
        duration: 5000,
      });
    });

    it("should show info toast for user unblocked with username", () => {
      actionToast.userUnblocked("testuser");
      expect(toast.info).toHaveBeenCalledWith("Unblocked testuser", {
        description: undefined,
        duration: 4000,
      });
    });
  });

  describe("report actions", () => {
    it("should show success toast for report submitted", () => {
      actionToast.reportSubmitted();
      expect(toast.success).toHaveBeenCalledWith("Report submitted", {
        description: "We'll review this shortly",
        duration: 3000,
      });
    });

    it("should show error toast for report error", () => {
      actionToast.reportError();
      expect(toast.error).toHaveBeenCalledWith("Failed to submit report", {
        description: "Please try again",
        duration: 5000,
      });
    });
  });

  describe("follow actions", () => {
    it("should show success toast for followed", () => {
      actionToast.followed("testuser");
      expect(toast.success).toHaveBeenCalledWith("Following testuser", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show info toast for unfollowed", () => {
      actionToast.unfollowed("testuser");
      expect(toast.info).toHaveBeenCalledWith("Unfollowed testuser", {
        description: undefined,
        duration: 4000,
      });
    });

    it("should show success toast for follow requested", () => {
      actionToast.followRequested("testuser");
      expect(toast.success).toHaveBeenCalledWith("Follow request sent to testuser", {
        description: undefined,
        duration: 3000,
      });
    });
  });

  describe("generic error", () => {
    it("should show error toast with action name", () => {
      actionToast.genericError("save post");
      expect(toast.error).toHaveBeenCalledWith("Failed to save post", {
        description: "Please try again",
        duration: 5000,
      });
    });

    it("should show error toast without action name", () => {
      actionToast.genericError();
      expect(toast.error).toHaveBeenCalledWith("Something went wrong", {
        description: "Please try again",
        duration: 5000,
      });
    });
  });

  describe("other actions", () => {
    it("should show success toast for comment added", () => {
      actionToast.commentAdded();
      expect(toast.success).toHaveBeenCalledWith("Comment posted", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show success toast for copied to clipboard", () => {
      actionToast.copied();
      expect(toast.success).toHaveBeenCalledWith("Copied to clipboard", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show success toast for copied item to clipboard", () => {
      actionToast.copied("Link");
      expect(toast.success).toHaveBeenCalledWith("Link copied to clipboard", {
        description: undefined,
        duration: 3000,
      });
    });

    it("should show info toast for signed out", () => {
      actionToast.signedOut();
      expect(toast.info).toHaveBeenCalledWith("Signed out successfully", {
        description: undefined,
        duration: 4000,
      });
    });
  });
});
