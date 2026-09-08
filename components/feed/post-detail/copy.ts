/** Dialog copy used by every post and take surface (V-4: one voice). */
export const DELETE_POST_COPY = {
  title: "Erase this from your studio?",
  description: "The post, its admires, and the conversation around it will fade for good. This page won't remember it.",
  confirm: "Erase it",
};

export const DELETE_TAKE_COPY = {
  title: "Delete Take?",
  description: "This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions.",
  confirm: "Delete",
};

export const BLOCK_COPY = {
  title: (handle: string) => `Close the door on @${handle}?`,
  description: "Their posts vanish from your feed and yours from theirs. They won't be able to follow you, message you, or knock again — and we won't tell them.",
  confirm: "Block",
};
