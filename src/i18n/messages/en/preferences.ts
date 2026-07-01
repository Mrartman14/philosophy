// src/i18n/messages/en/preferences.ts
// Mirror of ru/preferences.ts.
const preferences = {
  // --- preferences-form ---
  readingModeLabel: "Reading mode",
  readingModeDescription:
    "\"Focused\" hides secondary elements on the lecture page.",
  readingModeAriaLabel: "Reading mode",
  readingModeFull: "Full",
  readingModeFocused: "Focused",
  settingsSaved: "Settings saved.",
  saveButton: "Save",
  // Action phrase for "You don't have permission for {action}."
  updateSettingsAction: "changing settings",

  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "Notify me about replies to my comments",
  commentReplyNotifyDescription:
    "You get a notification when someone replies to your comment.",
  commentReplyNotifySaved: "Setting saved.",

  // --- push-send-form ---
  pushTitleLabel: "Title",
  pushBodyLabel: "Body",
  pushUrlLabel: "Link",
  pushUrlDescription:
    "Opens when the notification is tapped. A path (\"/lectures/…\") or a full http(s) URL.",
  pushTitlePlaceholder: "E.g. «New lecture»",
  pushSendAccepted: "Broadcast accepted and will be delivered to subscribers in the background.",
  pushSendButton: "Send",
  // Action phrase for "You don't have permission for {action}."
  pushSendAction: "sending push notifications",

  // --- push-subscription-toggle ---
  pushCheckingSubscription: "Checking subscription…",
  pushUnsupported: "Push notifications are not supported in this browser.",
  pushDenied: "Notifications are blocked. Allow them in your browser settings.",
  pushUnavailable: "Push notifications are temporarily unavailable.",
  pushSubscribed: "You are subscribed to notifications.",
  pushNotSubscribed: "You are not subscribed to notifications.",
  pushUnsubscribeButton: "Unsubscribe",
  pushSubscribeButton: "Subscribe",
  pushNoPermission: "You don't have permission to subscribe to notifications.",
  pushSubscribeError: "Failed to subscribe. Please try again.",
  pushUnsubscribeError: "Failed to unsubscribe. Please try again.",
  // Action phrase for "You don't have permission for {action}."
  pushSubscribeAction: "subscribing to notifications",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadFailed: "Failed to load preferences",
  },
};

export default preferences;
