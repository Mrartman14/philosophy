// src/i18n/messages/en/media.ts
// Mirror of ru/media.ts. Key parity is enforced by satisfies Messages.
const media = {
  // --- type and status ---
  typeVideo: "Video",
  typeAudio: "Audio",
  statusPublic: "Published",
  statusPrivate: "Private",

  // --- player ---
  playerArtist: "Философия ликбез",

  // --- empty states / informational ---
  emptyTitle: "No media yet",
  emptyDescription: "Upload a video or audio file — it will appear here.",
  unavailable: "File is not available for playback.",
  videoBrowserFallback: "Your browser does not support video playback.",
  audioBrowserFallback: "Your browser does not support audio playback.",

  // --- lectures section on media page ---
  lecturesSection: "Lectures",
  noContainers: "This media is not attached to any lecture.",
  lectureLink: "Lecture {id}…",

  // --- deletion ---
  deleteButton: "Delete",
  deleteTitle: "Delete media?",
  deleteDescription: "This action is irreversible. The file will be deleted and all links to it will stop working.",
  deleteDescriptionAdmin: "Deletion by administrator. This action is irreversible: the file will be deleted and all links to it will stop working.",
  deleteAction: "deleting media",

  // --- publishing ---
  publishButton: "Publish",
  publishTitle: "Publish media?",
  publishDescription:
    "Once published, the media will be public. It cannot be made private again — you can only delete it.",
  publishedToast: "Published",
  publishAction: "publishing media",

  // --- upload form ---
  uploadTypeLabel: "Type",
  uploadVideoOption: "Video (mp4, webm)",
  uploadAudioOption: "Audio (mp3, m4a, ogg)",
  uploadFileLabel: "File",
  uploadSubmit: "Upload",
  uploadHint: "New media is created as private. You can publish it on its page.",
  uploadSuccessTitle: "Uploaded",
  uploadAction: "uploading media",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "Failed to load media",
    loadItemFailed: "Failed to load media",
    loadContainersFailed: "Failed to load containers",
    loadAdminFailed: "Failed to load media list",
  },
};

export default media;
