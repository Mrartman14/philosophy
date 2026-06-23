// src/i18n/messages/zh/search.ts
const search = {
  // --- Search form (search-input.tsx) ---
  inputPlaceholder: "搜索文档和术语",
  inputAriaLabel: "搜索查询",
  submitButton: "搜索",
  headerInputPlaceholder: "搜索…",
  headerSubmitAriaLabel: "搜索",
  headerOpenAriaLabel: "打开搜索",

  // --- Search results (search-results.tsx) ---
  typeDocument: "文档",
  typeGlossary: "术语",
  untitled: "无标题",
  emptyTitle: "未找到任何内容",
  emptyDescription: "请尝试重新表述您的查询。",
  foundCount: "找到：{count}",

  // --- Loading skeleton (search-results-skeleton.tsx) ---
  loadingAriaLabel: "正在加载结果…",

  // --- API errors (api.ts) ---
  api: {
    fetchFailed: "搜索失败",
  },
};

export default search;
