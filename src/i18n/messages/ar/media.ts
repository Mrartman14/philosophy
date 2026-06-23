// src/i18n/messages/ar/media.ts
// Mirror of ru/media.ts. Key parity is enforced by satisfies Messages.
const media = {
  // --- type and status ---
  typeVideo: "فيديو",
  typeAudio: "صوت",
  statusPublic: "منشور",
  statusPrivate: "خاص",

  // --- player ---
  playerArtist: "Философия ликбез",
  pipEnter: "صورة داخل صورة",
  pipExit: "الخروج من وضع «صورة داخل صورة»",

  // --- empty states / informational ---
  emptyTitle: "لا توجد وسائط بعد",
  emptyDescription: "ارفع ملف فيديو أو صوت — وسيظهر هنا.",
  unavailable: "الملف غير متاح للتشغيل.",
  videoBrowserFallback: "متصفحك لا يدعم تشغيل الفيديو.",
  audioBrowserFallback: "متصفحك لا يدعم تشغيل الصوت.",

  // --- lectures section on media page ---
  lecturesSection: "المحاضرات",
  noContainers: "هذه الوسائط غير مرفقة بأي محاضرة.",
  lectureLink: "المحاضرة {id}…",

  // --- deletion ---
  deleteButton: "حذف",
  deleteTitle: "حذف الوسائط؟",
  deleteDescription: "هذا الإجراء لا يمكن التراجع عنه. سيُحذف الملف وستتوقف جميع الروابط المؤدية إليه عن العمل.",
  deleteDescriptionAdmin: "الحذف بواسطة المشرف. هذا الإجراء لا يمكن التراجع عنه: سيُحذف الملف وستتوقف جميع الروابط المؤدية إليه عن العمل.",
  deleteAction: "حذف الوسائط",

  // --- publishing ---
  publishButton: "نشر",
  publishTitle: "نشر الوسائط؟",
  publishDescription:
    "بعد النشر ستصبح الوسائط عامة. لا يمكن إعادتها إلى الوضع الخاص — يمكنك فقط حذفها.",
  publishedToast: "تم النشر",
  publishAction: "نشر الوسائط",

  // --- upload form ---
  uploadTypeLabel: "النوع",
  uploadVideoOption: "فيديو (mp4، webm)",
  uploadAudioOption: "صوت (mp3، m4a، ogg)",
  uploadFileLabel: "الملف",
  uploadSubmit: "رفع",
  uploadHint: "تُنشأ الوسائط الجديدة كخاصة. يمكنك نشرها من صفحتها.",
  uploadSuccessTitle: "تم الرفع",
  uploadAction: "رفع الوسائط",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "تعذّر تحميل الوسائط",
    loadItemFailed: "تعذّر تحميل الوسائط",
    loadContainersFailed: "تعذّر تحميل الحاويات",
    loadAdminFailed: "تعذّر تحميل قائمة الوسائط",
  },
};

export default media;
