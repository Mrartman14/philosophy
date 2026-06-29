// src/i18n/messages/ar/events.ts
// Mirror of ru/events.ts (Arabic literals). Key parity enforced by satisfies Messages.
const events = {
  // --- calendar navigation ---
  prevMonth: "السابق",
  nextMonth: "التالي",
  monthNavLabel: "التنقل بين الأشهر",
  noEvents: "لا توجد فعاليات هذا الشهر.",
  recurringEvent: "فعالية متكررة",

  // --- event-admin-row ---
  allDayBadge: " · طوال اليوم",
  recurringBadge: " · متكررة",
  editLink: "تحرير",

  // --- event-edit-form / event-create-form labels ---
  fieldTitle: "العنوان",
  fieldAllDay: "طوال اليوم",
  fieldStartDate: "تاريخ البدء",
  fieldStartDateTime: "تاريخ ووقت البدء (منطقتك الزمنية)",
  fieldEndDate: "تاريخ الانتهاء (اختياري)",
  fieldEndDateTime: "تاريخ ووقت الانتهاء (منطقتك الزمنية، اختياري)",
  fieldRrule: "التكرار (RRULE، اختياري)",
  fieldBlocks: "وصف الفعالية",
  titlePlaceholder: "مثال: «ندوة عن كانط»",
  clearLimitation:
    "لا يمكن مسح «تاريخ الانتهاء» و«التكرار» بعد حفظهما — أبقِ القيم الحالية أو أدخل قيمًا جديدة.",

  // --- event-edit-form status ---
  savedSuccess: "تم الحفظ.",
  // Case 3: per-feature action phrase for forbiddenAction.
  editAction: "تعديل الفعالية",

  // --- submit buttons ---
  saveButton: "حفظ",
  createButton: "إنشاء",

  // Case 3: per-feature action phrase for create form forbiddenAction
  createAction: "إنشاء فعالية",

  // --- event-delete-button ---
  deleteButton: "حذف",
  deleteDialogTitle: "حذف الفعالية؟",
  deleteDialogDescription:
    "هذا الإجراء لا يمكن التراجع عنه. ستختفي الفعالية من التقويم العام.",
  deleteConfirmLabel: "حذف",
  deleteAction: "حذف الفعالية",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "تعذّر تحميل الفعاليات",
    loadItemFailed: "تعذّر تحميل الفعالية",
    loadRevisionsFailed: "تعذّر تحميل المراجعات",
    loadRevisionFailed: "تعذّر تحميل المراجعة",
    loadCalendarFailed: "تعذّر تحميل التقويم",
  },
};

export default events;
