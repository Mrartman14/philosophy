// src/i18n/messages/zh/canvas.ts
// Mirror of ru/canvas.ts (Simplified Chinese literals). Key parity enforced by satisfies Messages.
import type { Messages } from "../ru";

const canvas: Messages["canvas"] = {
  // --- canvas-create-form ---
  createForm: {
    titleLabel: "名称",
    visibilityLabel: "可见性",
    dataLabel: "图谱数据（JSON，可选）",
    // ICU: escape the braces with single quotes, otherwise {"nodes"…} is parsed
    // by next-intl as a (malformed) placeholder → the key itself is rendered.
    dataDescription: "例如：'{\"nodes\":[],\"edges\":[]}'",
    visibilityPrivate: "私有",
    visibilityPublic: "公开",
    submitCreate: "创建",
    toastCreatedTitle: "画布已创建",
    toastErrorTitle: "错误",
  },

  // --- canvas-edit-form ---
  editForm: {
    titleLabel: "名称",
    dataLabel: "图谱数据（JSON）",
    submitSave: "保存",
    toastSavedTitle: "已保存",
    toastErrorTitle: "错误",
  },

  // --- canvas-delete-button ---
  deleteButton: {
    trigger: "删除",
    title: "删除画布？",
    description: "此操作不可撤销。",
    confirmLabel: "删除",
    toastDeletedTitle: "画布已删除",
  },

  // --- canvas-visibility-button ---
  visibilityButton: {
    makePublic: "设为公开",
    toastPublishedTitle: "画布已发布",
    toastErrorTitle: "错误",
  },

  // --- canvas-editor ---
  editor: {
    ariaLabel: "画布编辑器",
    toastValidationTitle: "图谱未通过校验",
    toastValidationFallback: "请修正错误。",
    toastSavedTitle: "已保存",
    toastSaveErrorTitle: "保存错误",
    toastCopiedTitle: "已复制到剪贴板",
    toastCopyErrorTitle: "复制失败",
    confirmLeave: "存在未保存的更改。要不保存就离开吗？",
    titleRequired: "请输入标题。",
  },

  // --- editor-toolbar ---
  toolbar: {
    back: "返回",
    addText: "文本",
    addRect: "矩形",
    addEllipse: "椭圆",
    addDiamond: "菱形",
    addLink: "连线",
    deleteSelected: "删除",
    undoAriaLabel: "撤销",
    redoAriaLabel: "重做",
    reset: "还原",
    toolSelect: "选择",
    toolHand: "抓手",
    fit: "适应内容",
    grid: "标尺",
    showCanvas: "画布",
    showJson: "JSON",
    export: "下载",
    exportSvg: "下载 SVG",
    exportPng: "下载 PNG",
    exportJson: "下载 JSON",
    copyJson: "复制为 JSON",
    unsavedChanges: "存在未保存的更改",
    saving: "保存中…",
    save: "保存",
    create: "创建",
  },

  // --- editor context menu (right-click) ---
  contextMenu: {
    center: "居中显示",
    bringToFront: "置于顶层",
    sendToBack: "置于底层",
    delete: "删除",
  },

  // --- editor-inspector ---
  inspector: {
    emptyHint: "请选择一个节点或边。",
    nodeHeading: "节点：{type}",
    nodeTextLabel: "文本",
    shapeLabel: "形状",
    shapeAriaLabel: "形状",
    shapeRect: "矩形",
    shapeEllipse: "椭圆",
    shapeDiamond: "菱形",
    xLabel: "X",
    yLabel: "Y",
    widthLabel: "宽度",
    heightLabel: "高度",
    edgeHeading: "边",
    edgeCaptionLabel: "标签",
    edgeStyleLabel: "样式",
    edgeStyleAriaLabel: "样式",
    edgeStyleSolid: "实线",
    edgeStyleDashed: "虚线",
    edgeEndLabel: "端点",
    edgeEndAriaLabel: "端点",
    edgeEndArrow: "箭头",
    edgeEndNone: "无箭头",
    edgeFromSideLabel: "起始侧",
    edgeFromSideAriaLabel: "起始侧",
    edgeToSideLabel: "终止侧",
    edgeToSideAriaLabel: "终止侧",
    sideAuto: "自动",
    sideTop: "上",
    sideRight: "右",
    sideBottom: "下",
    sideLeft: "左",
  },

  // --- entity-ref-dialog ---
  entityRefDialog: {
    title: "添加实体引用",
    typeLabel: "实体类型",
    typeAriaLabel: "实体类型",
    idLabel: "实体 ID",
    addButton: "添加",
    typeDocument: "文档",
    typeGlossary: "术语表",
    typeMedia: "媒体",
    typeCanvas: "画布",
    typeComment: "评论",
    typeAnnotation: "批注",
    typeForm: "表单",
    typeBanner: "横幅",
    typeEvent: "活动",
  },

  // --- entity-ref labels (resolveEntityRefView; entity-reference node chip) ---
  // 9 entity_ref types + fallback for an unknown type.
  entityType: {
    document: "文档",
    media: "媒体",
    comment: "评论",
    glossary: "术语表",
    form: "表单",
    canvas: "画布",
    annotation: "批注",
    banner: "横幅",
    event: "活动",
    fallback: "对象",
  },

  // --- canvas-my-list ---
  myList: {
    empty: "暂无画布。",
    untitled: "无标题",
    visibilityPublic: "公开",
    visibilityPrivate: "私有",
  },

  // --- canvas-containers ---
  containers: {
    title: "已包含在讲座中",
    emptyText: "该画布未包含在任何讲座中。",
    lectureLabel: "讲座 {id}",
  },

  // --- canvas-revisions ---
  revisions: {
    versionLabel: "版本 {num}",
  },

  // --- canvas-search ---
  search: {
    placeholder: "按名称搜索",
    submit: "查找",
  },

  // --- editor/validate.ts (graph structural validation; keys + ICU params) ---
  validate: {
    tooManyNodes: "节点过多：{count} > {max}",
    tooManyEdges: "边过多：{count} > {max}",
    nodeNoId: "某个节点没有标识符",
    duplicateNodeId: '节点标识符 "{id}" 重复',
    nodeSizePositive: '节点 "{id}"：尺寸必须为正值',
    textNodeNoText: '文本节点 "{id}" 没有文本',
    nodeTextTooLong: '节点 "{id}"：文本过长',
    shapeNoKind: '形状 "{id}" 没有形状类型',
    entityRefNoType: '引用 "{id}" 没有实体类型',
    entityRefNoId: '引用 "{id}" 没有实体标识符',
    nodeUnknownType: '节点 "{id}"：未知类型',
    edgeNoId: "某条边没有标识符",
    edgeFromNotFound: '边 "{id}"：未找到起点节点',
    edgeToNotFound: '边 "{id}"：未找到终点节点',
    edgeLabelTooLong: '边 "{id}"：标签过长',
  },

  // --- forbidden actions ---
  createForbiddenAction: "创建画布",
  updateForbiddenAction: "编辑画布",
  editorUpdateForbiddenAction: "编辑画布",
  deleteForbiddenAction: "删除画布",
  visibilityForbiddenAction: "更改画布可见性",

  // --- api.ts: fetch error messages (thrown to React error boundary) ---
  api: {
    loadCanvasesFailed: "无法加载画布列表",
    loadCanvasFailed: "无法加载画布",
    loadRevisionsFailed: "无法加载修订",
    loadRevisionFailed: "无法加载修订",
    loadContainersFailed: "无法加载关联",
  },
};

export default canvas;
