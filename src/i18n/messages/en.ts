// src/i18n/messages/en.ts
import type { Messages } from "./ru";

const en = {
  notifications: {
    documentUpdated: "A document you follow was updated",
    commentCreated: "{count, plural, one{# new comment} other{# new comments}}",
    commentReply: "A reply to your comment",
    annotationCreated: "New annotation",
    mention: "You were mentioned",
    fallback: "New notification",
  },
} satisfies Messages;

export default en;
