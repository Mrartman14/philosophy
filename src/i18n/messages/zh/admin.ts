// src/i18n/messages/zh/admin.ts
// Simplified Chinese translations for admin pages (src/app/admin/**), including the
// frozen shell (layout.tsx, admin-sidebar.tsx). Machine-generated; requires
// native-speaker review.
const admin = {
  // --- shell (layout.tsx + admin-sidebar.tsx) ---
  shellTitle: "管理后台",
  shellBackToSite: "返回网站",
  shellNavAriaLabel: "管理后台导航",

  // --- nav items (admin-sidebar.tsx; key comes from NavItem.labelKey) ---
  nav: {
    lectures: "讲座",
    glossary: "术语表",
    tags: "标签",
    events: "活动",
    banners: "横幅",
    documents: "文档",
    forms: "表单",
    trails: "路径",
    shareLinks: "链接",
    comments: "评论",
    annotations: "批注",
    media: "媒体",
    users: "用户",
    push: "推送通知",
    audit: "审计",
  },

  // --- страница /admin (dashboard) ---
  dashboardTitle: "管理后台",
  dashboardSubtitle: "通过左侧菜单管理各个版块。",

  // --- forbidden-страница (403) ---
  forbiddenTitle: "403",
  forbiddenDescription: "禁止访问管理后台。",

  // --- лекции ---
  lecturesTitle: "讲座",
  lecturesCreate: "创建",
  lecturesEmptyTitle: "暂无讲座",
  lecturesEmptyDescription: "创建第一个。",
  lecturesColTitle: "标题",
  lecturesColDate: "日期",
  lecturesColVisibility: "可见性",
  lecturesColActions: "操作",

  // --- новая лекция ---
  newLectureTitle: "新建讲座",

  // --- редактирование лекции ---
  editLectureTagsHeading: "标签",
  editLectureAttachmentsHeading: "附件",

  // --- прикрепления лекции ---
  attachmentsDocumentFallback: "文档",
  attachmentsDocsSectionTitle: "讲座文档",
  attachmentsMediaSectionTitle: "讲座媒体",

  // --- комментарии ---
  commentsTitle: "评论审核",
  commentsLectureIdLabel: "讲座 ID",
  commentsLectureIdPlaceholder: "讲座 UUID",
  commentsShowButton: "显示",
  commentsNoLectureHint: "请提供讲座 ID——后端没有全局评论列表。",
  commentsTotal: "共计：{total}",
  commentsEmpty: "暂无评论。",

  // --- аннотации ---
  annotationsTitle: "批注（公开）",
  annotationsDescription: "仅显示公开批注。可删除公开批注（私有批注无法审核）。",
  annotationsEmpty: "未找到任何内容。",

  // --- media (moderation) ---
  mediaTitle: "媒体审核",
  mediaDescription: "所有用户的非私有媒体。删除不可恢复。",
  mediaEmpty: "未找到任何内容。",
  mediaTotal: "共计：{total}",
  mediaOwnerLabel: "作者",
  mediaFilterOwnerLabel: "作者 ID",
  mediaFilterApply: "显示",
  mediaFilterClear: "重置",

  // --- пользователи ---
  usersTitle: "用户",
  usersTotal: "共计：{total}",

  // --- теги ---
  tagsTitle: "标签",
  tagsTotal: "共计：{total}",
  tagsEmptyTitle: "暂无标签",
  tagsEmptyDescription: "使用上方表单创建第一个标签。",

  // --- маршруты ---
  trailsTitle: "路径",
  trailsTotal: "公开路径。共计：{total}",

  // --- события ---
  eventsTitle: "活动",
  eventsTotal: "共计：{total}",

  // --- баннеры ---
  bannersTitle: "横幅",
  bannersTotal: "共计：{total}",
  bannerFallbackTitle: "横幅",

  // --- глоссарий ---
  glossaryTitle: "术语表",
  glossaryTotal: "共计：{total}",
  glossaryEditHint: "术语标题无法更改。只能编辑正文。",

  // --- документы ---
  documentsTitle: "文档",
  documentsTotal: "公开文档。共计：{total}",

  // --- формы ---
  formsTitle: "表单",
  formsTotal: "公开表单。共计：{total}",

  // --- share-ссылки ---
  shareLinksTitle: "链接审核",
  shareLinksDescription: "查看并撤销任意分享链接。请指定资源类型及其 ID。",
  shareLinksHint: "请在上方指定资源类型和 ID。",

  // --- push ---
  pushTitle: "推送通知",
  pushDescription: "群发将发送给所有已订阅的用户。发送是异步的——投递需要一些时间。",

  // --- SEO meta: page <title> ---
  dashboardMetaTitle: "管理后台",
  trailsMetaTitle: "路径 — 管理",
  commentsMetaTitle: "评论审核",
  formsMetaTitle: "表单 — 管理",
  shareLinksMetaTitle: "链接审核 — 管理",
  bannersMetaTitle: "横幅 — 管理",
  bannerEditMetaTitle: "横幅 — 编辑",
  tagsMetaTitle: "标签 — 管理",
  annotationsMetaTitle: "批注 — 审核",
  mediaMetaTitle: "媒体 — 审核",
  pushMetaTitle: "推送通知 — 管理",
  auditMetaTitle: "审计 — 管理",
  usersMetaTitle: "用户 — 管理",
  glossaryMetaTitle: "术语表 — 管理",
  glossaryEditMetaTitle: "术语表 — 编辑术语",
  glossaryNewMetaTitle: "术语表 — 新术语",
  glossaryNewHeading: "创建术语",
  glossaryNewBack: "返回术语列表",
  glossaryCreateLink: "创建术语",
  documentsMetaTitle: "文档 — 管理",
  lecturesMetaTitle: "讲座 — 管理",
  newLectureMetaTitle: "新建讲座",
  editLectureMetaTitle: "编辑讲座",
  eventsMetaTitle: "活动 — 管理",
  eventEditMetaTitle: "活动 — 编辑",
};

export default admin;
