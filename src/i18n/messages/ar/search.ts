// src/i18n/messages/ar/search.ts
const search = {
  // --- Search form (search-input.tsx) ---
  inputPlaceholder: "ابحث في المستندات والمصطلحات",
  inputAriaLabel: "استعلام البحث",
  submitButton: "بحث",
  headerInputPlaceholder: "بحث…",
  headerSubmitAriaLabel: "ابحث",
  headerOpenAriaLabel: "فتح البحث",

  // --- Search results (search-results.tsx) ---
  typeDocument: "مستند",
  typeGlossary: "مصطلح",
  untitled: "بدون عنوان",
  emptyTitle: "لم يُعثر على شيء",
  emptyDescription: "حاول إعادة صياغة استعلامك.",
  foundCount: "عُثر على: {count}",

  // --- Loading skeleton (search-results-skeleton.tsx) ---
  loadingAriaLabel: "جارٍ تحميل النتائج…",

  // --- API errors (api.ts) ---
  api: {
    fetchFailed: "فشل البحث",
  },
};

export default search;
