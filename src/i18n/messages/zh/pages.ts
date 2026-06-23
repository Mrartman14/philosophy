// src/i18n/messages/zh/pages.ts
// Simplified Chinese translations for public pages (src/app/** excluding admin/).
const pages = {
  // ─── Global errors / not-found / offline ─────────────────────────────
  errorTitle: "出错了",
  errorBody: "加载页面时发生错误。",
  errorRetry: "重试",
  errorCritical: "发生严重错误。请尝试刷新页面。",
  errorCriticalRetry: "重试",
  notFoundTitle: "页面未找到",
  notFoundHome: "返回首页",
  offlineTitle: "无网络连接",
  offlineHint: "请检查您的网络连接后重试。",

  // ─── Home page ────────────────────────────────────────────────────────
  homeTitle: "哲学入门",
  homeComingSoon: "内容正在准备中，请稍后再来。",

  // ─── Auth (login / register) ──────────────────────────────────────────
  loginTitle: "登录",
  loginHeading: "登录",
  loginBanned: "您的账户已被封禁。请联系客服支持。",
  loginRegistered: "注册成功。请使用您的用户名和密码登录。",
  loginNoAccount: "还没有账户？",
  loginRegisterLink: "注册",
  registerTitle: "注册",
  registerHeading: "注册",
  registerHasAccount: "已有账户？",
  registerLoginLink: "登录",

  // ─── /me ─────────────────────────────────────────────────────────────
  meTitle: "个人中心",
  meHint: "请在上方选择一个栏目。",

  // ─── /me nav sections ────────────────────────────────────────────────
  meNavNotifications: "通知",
  meNavDocuments: "我的文档",
  meNavMedia: "我的媒体",
  meNavAnnotations: "我的批注",
  meNavForms: "我的表单",
  meNavSubmissions: "我的提交",
  meNavStats: "我的统计",
  meNavSettings: "设置",
  meNavTokens: "访问令牌",
  meNavAriaLabel: "个人中心导航",

  // ─── /me/notifications ───────────────────────────────────────────────
  notificationsTitle: "通知",
  notificationsHeading: "通知",
  notificationsEmpty: "暂无通知。",

  // ─── /me/documents ───────────────────────────────────────────────────
  myDocumentsTitle: "我的文档",
  myDocumentsHeading: "我的文档",
  myDocumentsTotal: "共计：{total}",
  myDocumentsCreate: "创建文档",
  myDocumentsUpload: "上传 .md",

  // ─── /me/media ───────────────────────────────────────────────────────
  myMediaTitle: "我的媒体",
  myMediaHeading: "我的媒体",
  myMediaUploadSection: "上传",

  // ─── /me/annotations ─────────────────────────────────────────────────
  myAnnotationsTitle: "我的批注",
  myAnnotationsHeading: "我的批注",
  myAnnotationsEmpty: "您还没有任何批注。",

  // ─── /me/forms ───────────────────────────────────────────────────────
  myFormsTitle: "我的表单",
  myFormsHeading: "我的表单",
  myFormsCreate: "创建表单",

  // ─── /me/submissions ─────────────────────────────────────────────────
  mySubmissionsTitle: "我的提交",
  mySubmissionsHeading: "我的提交",

  // ─── /me/stats ───────────────────────────────────────────────────────
  myStatsTitle: "我的统计",
  myStatsHeading: "我的统计",
  myStatsCreated: "我创建的内容",
  myStatsViews: "我的浏览量",

  // ─── /lectures ───────────────────────────────────────────────────────
  lecturesTitle: "讲座",
  lecturesHeading: "讲座",
  lecturesLoadingLabel: "正在加载讲座…",

  // ─── /lectures/[id] ──────────────────────────────────────────────────
  lectureDefaultTitle: "讲座",

  // ─── /lectures/[id]/annotations ──────────────────────────────────────
  lectureAnnotationsTitle: "讲座批注",
  lectureAnnotationsHeading: "讲座批注",
  lectureAnnotationsEmpty: "这场讲座的资料暂无批注。",

  // ─── /glossary ───────────────────────────────────────────────────────
  glossaryTitle: "术语表",
  glossaryHeading: "术语表",
  glossaryLoadingLabel: "正在加载术语表…",

  // ─── /glossary/[id] ──────────────────────────────────────────────────
  termDefaultTitle: "术语",

  // ─── /calendar ───────────────────────────────────────────────────────
  calendarTitle: "日历",
  calendarHeading: "日历",

  // ─── /search ─────────────────────────────────────────────────────────
  searchTitle: "搜索",
  searchHeading: "搜索",
  searchSubtitle: "对文档和术语表术语进行语义搜索。",
  searchPlaceholder: "输入查询内容以开始搜索。",
  searchUnavailable: "搜索暂时不可用。请稍后再试。",

  // ─── /map ────────────────────────────────────────────────────────────
  mapTitle: "语义地图",
  mapLink: "在地图上查看",

  // ─── /graph ──────────────────────────────────────────────────────────
  graphTitle: "引用图谱",

  // ─── /me/tokens ──────────────────────────────────────────────────────
  tokensTitle: "个人令牌",
  tokensHeading: "个人访问令牌",
  tokensSubtitle:
    "用于以您的身份访问 API 的令牌——例如，用于连接使用自有 LLM 的外部服务。",

  // ─── /share-links ────────────────────────────────────────────────────
  shareLinksTitle: "我的链接",
  shareLinksHeading: "我的链接",
  shareLinksSubtitle: "管理分享链接。选择资源类型并输入其 ID，即可查看已生成的链接。",
  shareLinksHint: "请在上方指定资源类型和 ID。",

  // ─── /canvases ───────────────────────────────────────────────────────
  canvasesTitle: "画布",
  canvasesHeading: "画布",
  canvasesTotal: "共计：{total}",
  canvasesCreate: "创建画布",

  // ─── /canvases/new ───────────────────────────────────────────────────
  canvasNewTitle: "新建画布",
  canvasNewHeading: "新建画布",

  // ─── /canvases/[id] ──────────────────────────────────────────────────
  canvasDefaultTitle: "画布",
  canvasEditSection: "编辑",
  canvasOpenEditor: "打开编辑器",

  // ─── /canvases/[id]/edit ─────────────────────────────────────────────
  canvasEditorTitle: "画布编辑器",
  canvasEditorHeading: "画布编辑器 {title}",

  // ─── /documents ──────────────────────────────────────────────────────
  documentsLoadingLabel: "正在加载文档…",

  // ─── /documents/[id] ─────────────────────────────────────────────────
  documentDefaultTitle: "文档",
  documentEdit: "编辑",
  documentMarginHint: "页边批注在宽屏上显示于此处。",

  // ─── /documents/[id]/edit ────────────────────────────────────────────
  documentEditHeading: "编辑",
  documentEditBack: "返回文档",
  documentEditMetaTitleFull: "编辑：{filename}",
  documentEditMetaTitleFallback: "编辑文档",

  // ─── /trails ─────────────────────────────────────────────────────────
  trailsTitle: "路径",
  trailsHeading: "路径",
  trailsSubtitle: "精选讲座合集。共计：{total}",
  trailsLoadingLabel: "正在加载路径…",

  // ─── /trails/my ──────────────────────────────────────────────────────
  myTrailsTitle: "我的路径",
  myTrailsHeading: "我的路径",
  myTrailsTotal: "共计：{total}",
  myTrailsCreate: "创建路径",

  // ─── /trails/[id] ────────────────────────────────────────────────────
  trailDefaultTitle: "路径",
  trailEditSection: "编辑",

  // ─── /forms/[id] ─────────────────────────────────────────────────────
  formDefaultTitle: "表单",
  formSubmissionsLink: "提交",
  formFillSection: "填写",
  formEditSection: "编辑结构",
  formEditHint: "仅在发布前可用。发布后结构将被冻结。",
  formPublishedNote: "表单已发布——其结构无法更改。",

  // ─── /forms/[id]/submissions ─────────────────────────────────────────
  formSubmissionsTitle: "表单提交",
  formSubmissionsHeading: "提交：{formTitle}",
  formSubmissionsTotal: "共计：{total}",

  // ─── /comments/[id] ──────────────────────────────────────────────────
  commentTitle: "评论",
  commentThreadHeading: "讨论串",

  // ─── /media/[id] ─────────────────────────────────────────────────────
  mediaDefaultTitle: "媒体",

  // ─── /submissions/[id] ───────────────────────────────────────────────
  submissionTitle: "提交",
  submissionRetracted: "提交已撤回",
  submissionSent: "提交于 {date}",
  submissionYourResponse: "您的提交",
  submissionContents: "提交内容",

  // ─── /saved ──────────────────────────────────────────────────────────
  savedTitle: "离线已保存",
  savedListHeading: "离线已保存",
  savedListEmpty: "尚未保存任何内容。打开一场讲座并点击「离线保存」。",

  // ─── /saved/[id] (SavedLectureView) ──────────────────────────────────
  savedLectureMissing: "该讲座未离线保存。",
  savedLectureSaving: "讲座仍在保存中…",
  savedLectureIncomplete: "保存未完成：{error}。",
  savedLectureCorrupt: "已保存的快照已损坏或过时——请在线打开讲座并重新保存。",
  savedLectureGone: "该讲座已从平台中移除。您仍保留有已保存的副本。",
  savedLectureStale: "有可用的更新版本——请点击「刷新」。",
  savedLectureSavedAt: "离线已保存：",
  savedLectureRefreshing: "正在刷新…",
  savedLectureRefresh: "刷新",
  savedLectureRefreshError: "无法刷新——请检查您的网络连接。",
  savedLectureComments: "评论",
  savedLectureSavedBadge: "离线已保存 ✓",

  // ─── _offline/save-offline-button ────────────────────────────────────
  saveOfflineSaving: "正在保存…",
  saveOfflineButton: "离线保存",
  saveOfflineSuccessTitle: "已保存以供离线使用",
  saveOfflineFailTitle: "无法离线保存",
  saveOfflineUpdateAvailable: "有可用更新",
  saveOfflineUpdate: "更新",
  saveOfflineUpdating: "正在更新…",
  saveOfflineRemove: "删除副本",
  saveOfflineRemoving: "正在删除…",
  saveOfflineRemoveConfirmTitle: "删除离线副本？",
  saveOfflineRemoveConfirmBody:
    "副本将从此设备中删除。只能在线重新保存讲座以恢复它。",
  saveOfflineRemoveConfirmAction: "删除",
  saveOfflineRemovedToast: "离线副本已删除",
  saveOfflineRemoveFailTitle: "无法删除副本",

  // ─── saved-list stale sweep ──────────────────────────────────────────
  savedListStaleSaving: "保存已中断——请打开讲座并重新保存。",
};

export default pages;
