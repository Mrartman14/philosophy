// src/i18n/messages/en/pages.ts
// English translations for public pages (src/app/** excluding admin/).
const pages = {
  // ─── Global errors / not-found / offline ─────────────────────────────
  errorTitle: "Something went wrong",
  errorBody: "An error occurred while loading the page.",
  errorRetry: "Try again",
  errorCritical: "A critical error occurred. Try refreshing the page.",
  errorCriticalRetry: "Retry",
  notFoundTitle: "Page not found",
  notFoundHome: "Go to home",
  offlineTitle: "No internet",
  offlineHint: "Check your internet connection and try again.",

  // ─── Home page ────────────────────────────────────────────────────────
  homeTitle: "Philosophy Primer",
  homeComingSoon: "Content is being prepared. Check back later.",

  // ─── Auth (login / register) ──────────────────────────────────────────
  loginTitle: "Sign in",
  loginHeading: "Sign in",
  loginBanned: "Your account has been blocked. Please contact support.",
  loginRegistered: "Registration successful. Sign in with your username and password.",
  loginNoAccount: "No account?",
  loginRegisterLink: "Register",
  registerTitle: "Register",
  registerHeading: "Register",
  registerHasAccount: "Already have an account?",
  registerLoginLink: "Sign in",

  // ─── /me ─────────────────────────────────────────────────────────────
  meTitle: "My account",
  meHint: "Select a section above.",

  // ─── /me nav sections ────────────────────────────────────────────────
  meNavNotifications: "Notifications",
  meNavDocuments: "My documents",
  meNavMedia: "My media",
  meNavAnnotations: "My annotations",
  meNavForms: "My forms",
  meNavSubmissions: "My submissions",
  meNavStats: "My statistics",
  meNavSettings: "Settings",

  // ─── /me/notifications ───────────────────────────────────────────────
  notificationsTitle: "Notifications",
  notificationsHeading: "Notifications",
  notificationsEmpty: "No notifications yet.",

  // ─── /me/documents ───────────────────────────────────────────────────
  myDocumentsTitle: "My documents",
  myDocumentsHeading: "My documents",
  myDocumentsTotal: "Total: {total}",
  myDocumentsCreate: "Create document",
  myDocumentsUpload: "Upload .md",

  // ─── /me/media ───────────────────────────────────────────────────────
  myMediaTitle: "My media",
  myMediaHeading: "My media",
  myMediaUploadSection: "Upload",

  // ─── /me/annotations ─────────────────────────────────────────────────
  myAnnotationsTitle: "My annotations",
  myAnnotationsHeading: "My annotations",
  myAnnotationsEmpty: "You have no annotations yet.",

  // ─── /me/forms ───────────────────────────────────────────────────────
  myFormsTitle: "My forms",
  myFormsHeading: "My forms",
  myFormsCreate: "Create form",

  // ─── /me/submissions ─────────────────────────────────────────────────
  mySubmissionsTitle: "My submissions",
  mySubmissionsHeading: "My submissions",

  // ─── /me/stats ───────────────────────────────────────────────────────
  myStatsTitle: "My statistics",
  myStatsHeading: "My statistics",
  myStatsCreated: "What I created",
  myStatsViews: "My views",

  // ─── /lectures ───────────────────────────────────────────────────────
  lecturesTitle: "Lectures",
  lecturesHeading: "Lectures",
  lecturesLoadingLabel: "Loading lectures…",

  // ─── /lectures/[id] ──────────────────────────────────────────────────
  lectureDefaultTitle: "Lecture",

  // ─── /lectures/[id]/annotations ──────────────────────────────────────
  lectureAnnotationsTitle: "Lecture annotations",
  lectureAnnotationsHeading: "Lecture annotations",
  lectureAnnotationsEmpty: "No annotations for this lecture yet.",

  // ─── /glossary ───────────────────────────────────────────────────────
  glossaryTitle: "Glossary",
  glossaryHeading: "Glossary",
  glossaryLoadingLabel: "Loading glossary…",

  // ─── /glossary/[id] ──────────────────────────────────────────────────
  termDefaultTitle: "Term",

  // ─── /calendar ───────────────────────────────────────────────────────
  calendarTitle: "Calendar",
  calendarHeading: "Calendar",

  // ─── /search ─────────────────────────────────────────────────────────
  searchTitle: "Search",
  searchHeading: "Search",
  searchSubtitle: "Global search across lectures and glossary terms.",
  searchPlaceholder: "Enter a query to start searching.",
  searchUnavailable: "Search is temporarily unavailable. Try again later.",

  // ─── /share-links ────────────────────────────────────────────────────
  shareLinksTitle: "My links",
  shareLinksHeading: "My links",
  shareLinksSubtitle: "Manage share links. Select the resource type and enter its ID to see issued links.",
  shareLinksHint: "Specify the resource type and ID above.",

  // ─── /canvases ───────────────────────────────────────────────────────
  canvasesTitle: "Canvases",
  canvasesHeading: "Canvases",
  canvasesTotal: "Total: {total}",
  canvasesCreate: "Create canvas",

  // ─── /canvases/new ───────────────────────────────────────────────────
  canvasNewTitle: "New canvas",
  canvasNewHeading: "New canvas",

  // ─── /canvases/[id] ──────────────────────────────────────────────────
  canvasDefaultTitle: "Canvas",
  canvasEditSection: "Edit",
  canvasOpenEditor: "Open editor",

  // ─── /canvases/[id]/edit ─────────────────────────────────────────────
  canvasEditorTitle: "Canvas editor",
  canvasEditorHeading: "Canvas editor {title}",

  // ─── /documents ──────────────────────────────────────────────────────
  documentsLoadingLabel: "Loading documents…",

  // ─── /documents/[id] ─────────────────────────────────────────────────
  documentDefaultTitle: "Document",
  documentEdit: "Edit",

  // ─── /documents/[id]/edit ────────────────────────────────────────────
  documentEditHeading: "Edit",
  documentEditBack: "← Back to document",
  documentEditMetaTitleFull: "Edit: {filename}",
  documentEditMetaTitleFallback: "Edit document",

  // ─── /trails ─────────────────────────────────────────────────────────
  trailsTitle: "Trails",
  trailsHeading: "Trails",
  trailsSubtitle: "Curated lecture collections. Total: {total}",
  trailsLoadingLabel: "Loading trails…",

  // ─── /trails/my ──────────────────────────────────────────────────────
  myTrailsTitle: "My trails",
  myTrailsHeading: "My trails",
  myTrailsTotal: "Total: {total}",
  myTrailsCreate: "Create trail",

  // ─── /trails/[id] ────────────────────────────────────────────────────
  trailDefaultTitle: "Trail",
  trailEditSection: "Edit",

  // ─── /forms/[id] ─────────────────────────────────────────────────────
  formDefaultTitle: "Form",
  formSubmissionsLink: "Submissions",
  formFillSection: "Fill in",
  formEditSection: "Edit structure",
  formEditHint: "Available only before publishing. The structure is frozen after publishing.",
  formPublishedNote: "The form is published — its structure cannot be changed.",

  // ─── /forms/[id]/submissions ─────────────────────────────────────────
  formSubmissionsTitle: "Form submissions",
  formSubmissionsHeading: "Submissions: {formTitle}",
  formSubmissionsTotal: "Total: {total}",

  // ─── /comments/[id] ──────────────────────────────────────────────────
  commentTitle: "Comment",
  commentThreadHeading: "Discussion thread",

  // ─── /media/[id] ─────────────────────────────────────────────────────
  mediaDefaultTitle: "Media",

  // ─── /submissions/[id] ───────────────────────────────────────────────
  submissionTitle: "Submission",
  submissionRetracted: "Submission retracted",
  submissionSent: "Submitted on {date}",
  submissionYourResponse: "Your submission",
  submissionContents: "Submission contents",

  // ─── /saved ──────────────────────────────────────────────────────────
  savedTitle: "Saved offline",
  savedListHeading: "Saved offline",
  savedListEmpty: "Nothing saved yet. Open a lecture and click «Save offline».",

  // ─── /saved/[id] (SavedLectureView) ──────────────────────────────────
  savedLectureMissing: "This lecture is not saved offline.",
  savedLectureSaving: "The lecture is still being saved…",
  savedLectureIncomplete: "Saving not complete: {error}.",
  savedLectureCorrupt: "The saved snapshot is corrupted or outdated — open the lecture online and save again.",
  savedLectureGone: "This lecture has been removed from the platform. You still have a saved copy.",
  savedLectureStale: "An updated version is available — click «Refresh».",
  savedLectureSavedAt: "Saved offline:",
  savedLectureRefreshing: "Refreshing…",
  savedLectureRefresh: "Refresh",
  savedLectureRefreshError: "Could not refresh — check your connection.",
  savedLectureComments: "Comments",
  savedLectureSavedBadge: "Saved offline ✓",

  // ─── _offline/save-offline-button ────────────────────────────────────
  saveOfflineSaving: "Saving…",
  saveOfflineButton: "Save offline",
  saveOfflineSuccessTitle: "Saved for offline",
  saveOfflineFailTitle: "Could not save offline",

  // ─── saved-list stale sweep ──────────────────────────────────────────
  savedListStaleSaving: "Saving interrupted — open the lecture and save again.",
};

export default pages;
