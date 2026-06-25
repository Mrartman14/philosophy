// src/i18n/messages/en/admin.ts
// English translations for admin pages (src/app/admin/**), including the
// frozen shell (layout.tsx, admin-sidebar.tsx). Machine-generated; requires
// native-speaker review.
const admin = {
  // --- shell (layout.tsx + admin-sidebar.tsx) ---
  shellTitle: "Admin panel",
  shellBackToSite: "To the site",
  shellNavAriaLabel: "Admin panel navigation",

  // --- nav items (admin-sidebar.tsx; key comes from NavItem.labelKey) ---
  nav: {
    lectures: "Lectures",
    glossary: "Glossary",
    tags: "Tags",
    events: "Events",
    banners: "Banners",
    documents: "Documents",
    forms: "Forms",
    trails: "Trails",
    shareLinks: "Links",
    comments: "Comments",
    annotations: "Annotations",
    media: "Media",
    users: "Users",
    push: "Push notifications",
    audit: "Audit",
  },

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
  editLectureAttachmentsLink: "Manage lecture documents and media",

  // --- прикрепления лекции ---
  attachmentsDocumentFallback: "Document",
  attachmentsDocsSectionTitle: "Lecture documents",
  attachmentsMediaSectionTitle: "Lecture media",

  // --- lecture card (/admin/lectures/[id]) ---
  cardMetaTitle: "Lecture",
  cardEditLink: "Edit lecture",
  cardDocumentsHeading: "Documents",
  cardMediaHeading: "Media",
  cardMediaUnavailable: "Media file is unavailable.",

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

  // --- media (moderation) ---
  mediaTitle: "Media moderation",
  mediaDescription: "Non-private media from all users. Deletion is irreversible.",
  mediaEmpty: "Nothing found.",
  mediaTotal: "Total: {total}",
  mediaOwnerLabel: "Author",
  mediaFilterOwnerLabel: "Author ID",
  mediaFilterApply: "Show",
  mediaFilterClear: "Reset",

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
  mediaMetaTitle: "Media — moderation",
  pushMetaTitle: "Push notifications — admin",
  auditMetaTitle: "Audit — admin",
  usersMetaTitle: "Users — admin",
  glossaryMetaTitle: "Glossary — admin",
  glossaryEditMetaTitle: "Glossary — edit term",
  glossaryNewMetaTitle: "Glossary — new term",
  glossaryNewHeading: "Create a term",
  glossaryNewBack: "Back to terms",
  glossaryCreateLink: "Create term",
  documentsMetaTitle: "Documents — admin",
  lecturesMetaTitle: "Lectures — admin",
  newLectureMetaTitle: "New lecture",
  editLectureMetaTitle: "Edit lecture",
  eventsMetaTitle: "Events — admin",
  eventEditMetaTitle: "Events — edit",
};

export default admin;
