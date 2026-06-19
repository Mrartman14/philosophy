// src/i18n/messages/en/media.ts
// Mirror of ru/media.ts. Key parity is enforced by satisfies Messages.
const media = {
  // --- type and status ---
  typeVideo: "Video",
  typeAudio: "Audio",
  statusPublic: "Published",
  statusPrivate: "Private",

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
  uploadBusy: "Uploading…",
  uploadSubmit: "Upload",
  uploadHint: "New media is created as private. You can publish it on its page.",
  uploadToastNoFile: "Choose a file",
  uploadErrorTitle: "Upload error",
  uploadSuccessTitle: "Uploaded",
  uploadAction: "uploading media",
  uploadFileTooLarge: "File is too large (max 100 MB).",
  uploadInvalidFormat: "Unsupported format. Video: mp4/webm. Audio: mp3/m4a/ogg.",
  uploadSelectType: "Choose a type: video or audio.",
};

export default media;
