// src/i18n/messages/zh/errors.ts
// Зеркало ru/errors.ts (английские литералы). Паритет ключей форсит satisfies Messages.
const errors = {
  // --- api-error: backend codes (DEFAULT_MESSAGES) ---
  REF_NOT_FOUND: "其中一个引用指向了不存在的对象。",
  BLOCKS_HAVE_ANCHORS:
    "无法删除带有锚定评论的块。请先删除评论，或保留该块。",
  VERSION_MISMATCH:
    "该对象已在别处被修改。请刷新页面后重试。",
  IF_MATCH_REQUIRED:
    "无法确定对象的版本。请刷新页面后重试。",
  IDEMPOTENCY_KEY_IN_USE:
    "请求正在处理中。请稍候，不要重复提交。",
  IDEMPOTENCY_KEY_REUSED:
    "已修改的请求与已发送的请求冲突。请刷新页面。",
  IDEMPOTENCY_KEY_INVALID:
    "无法安全地重新提交请求。请刷新页面后重试。",

  // --- comments slice: domain codes ---
  SELF_REACTION: "无法对自己的评论作出反应。",
  AXIS_NOT_ALLOWED: "此反应不适用于该评论类型。",
  INVALID_INSIGHT_VALUE: "「洞见」反应仅支持正值。",
  COMMENT_DELETED: "评论已被删除。",
  PARENT_NOT_AVAILABLE: "父评论不可用。",
  PARENT_WRONG_LECTURE: "父评论不可用。",
  // 评论锚点（绑定到片段）。后端 422 错误码，见
  // POST /api/lectures/{id}/comments。文本漂移时常出现 ANCHOR_BLOCK_NOT_FOUND。
  ANCHOR_ENTITY_UNKNOWN: "评论锚点的目标类型未知。",
  ANCHOR_BLOCK_NOT_FOUND: "所选片段已不可用——请重新选择。",
  ANCHOR_TARGET_NOT_FOUND: "未找到评论锚点的目标。",
  ANCHOR_TARGET_WRONG_LECTURE: "锚点目标属于另一场讲座。",
  INVALID_ROOT_TYPE: "此评论类型不能用作根评论。",
  INVALID_TYPE_FOR_PARENT:
    "此评论类型不允许作为对所选节点的回复。",
  MAX_DEPTH_EXCEEDED: "已超出线程的最大深度。",
  BLOCKS_EMPTY: "评论不能为空。",
  BLOCKS_INVALID: "评论文本包含无效的格式。",
  BLOCK_ID_UNKNOWN: "块 ID 错误。请重新加载编辑器。",
  DUPLICATE_BLOCK_ID: "块 ID 错误。请重新加载编辑器。",
  COMMENT_REFERENCED:
    "其他内容引用了此评论。请先删除这些引用。",
  BLOCK_REFERENCED:
    "有外部引用指向此评论中的某个块。请先删除该引用。",
  // BLOCKS_HAVE_ANCHORS for comments differs from the default (document/glossary context):
  BLOCKS_HAVE_ANCHORS_COMMENT:
    "有其他评论锚定到此评论的块上。请先解除其锚定。",

  // --- forms slice: domain codes ---
  FORM_PUBLISHED: "表单已发布——其结构无法更改。",
  FORM_PUBLIC_IMMUTABLE: "公开表单无法重新设为私有。",
  MODE_CHANGE_FORBIDDEN: "「不可变」模式无法切换为可编辑模式。",
  FORM_IMMUTABLE_MODE:
    "此表单不允许编辑或删除回复——只能撤回。",
  RETRACT_NOT_APPLICABLE: "撤回仅适用于不允许编辑回复的表单。",
  ALREADY_SUBMITTED: "您已对此表单提交过回复。",
  ALREADY_RETRACTED: "该回复已被撤回。",
  INVALID_FORM_SCHEMA: "表单结构未通过校验。",
  INVALID_SUBMISSION: "答案未通过校验。请正确填写所有必填字段。",
  FORM_NOT_FOUND: "未找到表单。",
  SUBMISSION_NOT_FOUND: "未找到回复。",
  FORM_BLOCKS_INVALID: "表单描述未通过校验。",

  // --- documents slice: domain codes ---
  DOCUMENT_PUBLIC_IMMUTABLE: "公开文档无法设为私有。",
  DOCUMENT_REFERENCED:
    "其他内容引用了此文档。请删除这些引用后重试。",
  DOCUMENT_BLOCK_REFERENCED:
    "有外部引用指向此文档中的某个块。请删除该引用，或保留该块。",
  DOCUMENT_BLOCKS_HAVE_ANCHORS:
    "无法删除带有锚定评论的块。请先删除评论。",
  DOCUMENT_BLOCKS_EMPTY: "文档必须至少包含一个块。",
  DOCUMENT_BLOCKS_INVALID: "文档文本包含无效的格式。",
  DOCUMENT_BLOCK_ID_UNKNOWN: "块 ID 错误。请重新加载编辑器。",
  DOCUMENT_DUPLICATE_BLOCK_ID: "块 ID 错误。请重新加载编辑器。",
  DOCUMENT_IMAGE_UNKNOWN_KEY: "文档中含有键未知的图片。",

  // --- api-error: 413 — generic default (comment create, search/context, etc.) ---
  REQUEST_BODY_TOO_LARGE: "请求过大。请减少内容后重试。",
  PAYLOAD_TOO_LARGE: "请求过大。请减少内容后重试。",

  // --- canvas slice: domain codes ---
  PUBLIC_IMMUTABLE: "公开画布无法设为私有。",
  CANVAS_VERSION_MISMATCH:
    "画布已在别处被修改——请刷新页面后重试。",
  CANVAS_PAYLOAD_TOO_LARGE: "图谱数据过大（上限 1 MiB）。",
  CANVAS_VALIDATION_ERROR:
    "图谱未通过校验（节点／边／实体引用）。",

  // --- banners slice: domain codes ---
  BANNER_INVALID_COLOR:
    "背景颜色无效：请使用 #RGB 或 #RRGGBB 形式的十六进制值。",
  BANNER_INVALID_DATE:
    "展示日期无效：请检查格式以及开始与结束的顺序。",
  BANNER_INVALID_EVENT: "未找到此 ID 的活动。",
  BANNER_BLOCKS_INVALID: "横幅文本包含无效的格式。",
  BANNER_BLOCK_REFERENCED:
    "其他内容引用了此横幅中的某个块。请删除这些引用，或保留该块。",
  BANNER_NOT_DISMISSIBLE: "此横幅无法关闭。",

  // --- users slice: domain codes ---
  USER_NOT_FOUND: "未找到用户。",

  // --- lectures slice: domain codes ---
  UPLOAD_NOT_FOUND: "未找到已上传的图片。请重试。",
  ALREADY_ATTACHED: "该实体已附加到讲座。",
  INVALID_ENTITY_TYPE: "实体类型无效。",
  // NOT_FOUND — generic backend code; not added to the global catalog to prevent
  // isErrorKey from treating it as a catalog key for all slices.
  // The lectures slice maps NOT_FOUND → LECTURE_NOT_FOUND in its ERRORS map.
  LECTURE_NOT_FOUND: "未找到讲座。",

  // --- events slice: domain codes ---
  INVALID_DATE:
    "日期无效：请检查格式以及开始与结束日期的顺序。",
  INVALID_RRULE: "无法识别重复规则。请检查重复设置。",
  EVENT_BLOCKS_INVALID: "活动描述包含无效的格式。",
  EVENT_BLOCK_REFERENCED:
    "其他内容引用了此活动中的某个块。请删除这些引用，或保留该块。",

  // --- trails slice: domain codes ---
  TRAIL_PUBLIC_IMMUTABLE: "公开路径无法设为私有——只能删除。",
  TRAIL_DUPLICATE_DOCUMENT: "同一文档被两次添加到路径中。请删除重复项。",
  TRAIL_DOCUMENT_NOT_FOUND: "其中一个文档未找到。请更新列表后重试。",

  // --- media slice: domain codes ---
  MEDIA_PUBLIC_IMMUTABLE:
    "公开媒体无法设为私有。请删除后重新上传。",
  MEDIA_NOT_FOUND: "未找到媒体。",
  MEDIA_INVALID_FORMAT: "不支持的格式。视频：mp4/webm。音频：mp3/m4a/ogg。",
  MEDIA_FILE_TOO_LARGE: "文件过大（最大 100 MB）。",

  // --- share-links slice: domain codes ---
  SHARE_LINK_NOT_FOUND: "未找到资源，或您不是其所有者。",
  RESOURCE_NOT_PRIVATE: "分享链接只能为私有资源创建。",

  // --- preferences slice: domain codes ---
  NOT_CONFIGURED: "推送通知尚未设置。",

  // --- tokens slice: domain codes ---
  TOKEN_LIMIT: "已达到令牌上限。请撤销未使用的令牌后重试。",

  // --- tags slice: domain codes ---
  TAG_CONFLICT: "已存在同名标签。",
  TAG_NOT_FOUND: "未找到对象——可能已被删除。请刷新页面。",

  // --- glossary slice: domain codes ---
  GLOSSARY_BLOCKS_EMPTY: "术语正文不能为空。",
  GLOSSARY_BLOCK_REFERENCED:
    "其他内容引用了此术语中的某个块。请删除这些引用，或保留该块。",

  // --- annotations slice: domain codes ---
  ANNOTATION_BLOCKS_EMPTY: "批注正文不能为空。",
  ANNOTATION_BLOCKS_INVALID: "批注文本包含无效的格式。",
  ANNOTATION_ANCHOR_INVALID: "批注锚点无效。",
  ANNOTATION_INVALID_PARENT_TYPE: "此实体类型不支持批注。",
  ANNOTATION_REQUEST_BODY_TOO_LARGE: "批注过大。",

  // --- api-error: rethrowApiError fallbacks ---
  serverError: "服务器错误",
  accountRestricted: "账户受限。",

  // --- branded forbidden/suspended ---
  // {action} — the action phrase, e.g. "deleting the lecture".
  forbiddenAction: "您没有执行{action}的权限。",
  forbiddenGeneric: "您没有权限。",
  forbiddenTitle: "无权限",
  failureTitle: "错误",
  unknown: "未知错误",
};

export default errors;
