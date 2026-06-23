// src/i18n/messages/zh/editor.ts
// UI strings for the AST editor component (mirror of ru/editor.ts).
const editor = {
  // --- Editor (use-ast-editor) ---
  editorAriaLabel: "AST 编辑器",

  // --- Schema context (schema-context) ---
  schemaUnavailable: "AST schema 不可用：{message}",

  // --- Image node view (image-node-view) ---
  imageLoading: "图片加载中",

  // --- Toolbar: inline marks (inline-marks) ---
  bold: "加粗",
  italic: "斜体",
  code: "代码",

  // --- Toolbar: block buttons (block-buttons) ---
  blockquote: "引用",
  codeBlock: "代码块",
  thematicBreak: "水平分隔线",
  table: "表格",

  // --- Toolbar: list buttons (list-buttons) ---
  bulletList: "无序列表",
  orderedList: "有序列表",
  checkList: "清单",

  // --- Toolbar: heading select (heading-select) ---
  blockTypeAriaLabel: "块类型",
  paragraph: "段落",
  heading1: "标题 1",
  heading2: "标题 2",
  heading3: "标题 3",
  heading4: "标题 4",
  heading5: "标题 5",
  heading6: "标题 6",

  // --- Toolbar: link popover (link-popover) ---
  linkAriaLabel: "链接",
  linkUrlAriaLabel: "链接 URL",
  linkInvalidScheme: "链接协议无效（允许 http、https、mailto）",
  linkRemove: "移除链接",
  linkApply: "应用",

  // --- Toolbar: ref popover (ref-popover) ---
  insertRefAriaLabel: "插入实体引用",

  // --- Toolbar: image button (image-button) ---
  imageAriaLabel: "图片",
  imageUploadFailTitle: "图片上传失败",
  imageUploadFailGeneric: "发生错误。请重试。",
  imageUploadForbidden: "您没有上传图片的权限。",
  imageUploadTooLarge: "图片过大（最大 10 MiB）",
  imageUploadInvalidMime: "不支持的文件格式",
  imageUploadNetworkError: "网络错误",
  imageUploadNoAccess: "拒绝访问",
  imageUploadFailed: "上传错误：{status}",

  // --- Toolbar: slash menu (slash-menu) ---
  slashMenuAriaLabel: "块命令",
  slashMenuNoMatches: "无匹配项",
  slashMenuClose: "Esc — 关闭",
  slashMenuHeading: "标题 {level}",
  slashMenuBlockquote: "引用",
  slashMenuCodeBlock: "代码块",
  slashMenuBulletList: "无序列表",
  slashMenuOrderedList: "有序列表",
  slashMenuThematicBreak: "分隔线",
  slashMenuTable: "表格 3×3",

  // --- Ref menu (ref-menu) ---
  insertRefDialogAriaLabel: "插入引用",
  refCategoryGlossary: "术语",
  refCategoryDocument: "文档",
  refCategoryMedia: "媒体",
  refCategoryComment: "评论",

  // --- Async combobox (async-combobox) ---
  comboboxEmpty: "未找到任何内容",
  comboboxError: "加载错误",
  comboboxLoading: "加载中…",
  comboboxRetry: "重试",
  comboboxLoadMore: "加载更多",

  // --- Pickers: placeholders ---
  lecturePlaceholder: "搜索讲座…",
  glossaryPlaceholder: "搜索术语…",
  documentPlaceholder: "搜索文档…",
  mediaPlaceholder: "搜索媒体…",
  canvasPlaceholder: "搜索 canvas…",
  commentPlaceholder: "在所选讲座中搜索评论…",

  // --- Media picker (media-picker) ---
  mediaTypeLabel: "类型",
  mediaTypeAll: "全部",
  mediaTypeVideo: "视频",
  mediaTypeAudio: "音频",

  // --- Comment 2-stage picker (comment-2stage-picker) ---
  commentPickerStep1: "第 1 步：选择讲座",
  commentPickerStep2: "第 2 步：选择评论",
  commentPickerChangeLecture: "更换讲座",

  // --- Schema server (schema-server) ---
  schemaLoadError: "无法加载 AST 编辑器架构",
};

export default editor;
