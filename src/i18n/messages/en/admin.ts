// src/i18n/messages/en/admin.ts
// English translations for admin pages (src/app/admin/**).
// Machine-generated; requires native-speaker review.
const admin = {
  // --- общие ---
  totalCount: "Total: {total}",

  // --- страница /admin (dashboard) ---
  dashboardTitle: "Admin panel",
  dashboardSubtitle: "Manage sections via the left menu.",

  // --- forbidden-страница (403) ---
  forbiddenTitle: "403",
  forbiddenDescription: "Access to the admin panel is denied.",

  // --- лекции ---
  lecturesTitle: "Lectures",
  lecturesCreate: "Create",
  lecturesEmptyTitle: "No lectures yet",
  lecturesEmptyDescription: "Create the first one.",
  lecturesColTitle: "Title",
  lecturesColDate: "Date",
  lecturesColVisibility: "Visibility",
  lecturesColActions: "Actions",

  // --- новая лекция ---
  newLectureTitle: "New lecture",

  // --- редактирование лекции ---
  editLectureTagsHeading: "Tags",
  editLectureAttachmentsHeading: "Attachments",
  editLectureAttachmentsLink: "Manage lecture documents and media →",

  // --- прикрепления лекции ---
  attachmentsPageTitle: "{lectureTitle}: attachments",
  attachmentsDocumentFallback: "Document",
  attachmentsDocsSectionTitle: "Lecture documents",
  attachmentsMediaSectionTitle: "Lecture media",

  // --- комментарии ---
  commentsTitle: "Comment moderation",
  commentsLectureIdLabel: "Lecture ID",
  commentsLectureIdPlaceholder: "Lecture UUID",
  commentsShowButton: "Show",
  commentsNoLectureHint: "Provide a lecture ID — there is no global comment list on the backend.",
  commentsTotal: "Total: {total}",
  commentsEmpty: "No comments.",

  // --- аннотации ---
  annotationsTitle: "Annotations (public)",
  annotationsDescription: "Only public annotations are visible. Deletion is available for public annotations (private ones cannot be moderated).",
  annotationsEmpty: "Nothing found.",

  // --- пользователи ---
  usersTitle: "Users",
  usersTotal: "Total: {total}",

  // --- теги ---
  tagsTitle: "Tags",
  tagsTotal: "Total: {total}",
  tagsEmptyTitle: "No tags yet",
  tagsEmptyDescription: "Create the first tag using the form above.",

  // --- маршруты ---
  trailsTitle: "Trails",
  trailsTotal: "Public trails. Total: {total}",

  // --- события ---
  eventsTitle: "Events",
  eventsTotal: "Total: {total}",

  // --- баннеры ---
  bannersTitle: "Banners",
  bannersTotal: "Total: {total}",
  bannerFallbackTitle: "Banner",

  // --- глоссарий ---
  glossaryTitle: "Glossary",
  glossaryTotal: "Total: {total}",
  glossaryEditHint: "The term title cannot be changed. Only the body can be edited.",

  // --- документы ---
  documentsTitle: "Documents",
  documentsTotal: "Public documents. Total: {total}",

  // --- формы ---
  formsTitle: "Forms",
  formsTotal: "Public forms. Total: {total}",

  // --- share-ссылки ---
  shareLinksTitle: "Link moderation",
  shareLinksDescription: "View and revoke any share links. Specify the resource type and its ID.",
  shareLinksHint: "Specify the resource type and ID above.",

  // --- push ---
  pushTitle: "Push notifications",
  pushDescription: "The broadcast is sent to all subscribed users. Sending is asynchronous — delivery takes time.",

  // --- SEO meta: page <title> ---
  dashboardMetaTitle: "Admin panel",
  trailsMetaTitle: "Trails — admin",
  commentsMetaTitle: "Comment moderation",
  formsMetaTitle: "Forms — admin",
  shareLinksMetaTitle: "Link moderation — admin",
  bannersMetaTitle: "Banners — admin",
  bannerEditMetaTitle: "Banners — edit",
  tagsMetaTitle: "Tags — admin",
  annotationsMetaTitle: "Annotations — moderation",
  pushMetaTitle: "Push notifications — admin",
  auditMetaTitle: "Audit — admin",
  usersMetaTitle: "Users — admin",
  glossaryMetaTitle: "Glossary — admin",
  glossaryEditMetaTitle: "Glossary — edit term",
  documentsMetaTitle: "Documents — admin",
  lecturesMetaTitle: "Lectures — admin",
  newLectureMetaTitle: "New lecture",
  editLectureMetaTitle: "Edit lecture",
  attachmentsMetaTitle: "Lecture attachments",
  eventsMetaTitle: "Events — admin",
  eventEditMetaTitle: "Events — edit",
};

export default admin;
