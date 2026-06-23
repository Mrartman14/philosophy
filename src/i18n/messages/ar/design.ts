// src/i18n/messages/ar/design.ts
import type ru from "../ru/design";

const design = {
  metaTitle: "نظام التصميم",
  appearanceTitle: "المظهر",
  appearanceWarning:
    "يغيّر إعدادات المظهر على هذا الجهاز (وفي حسابك إذا كنت مسجّل الدخول). هذا هو نظام المظهر الحقيقي: بدّل المحاور وراقب كيف تتفاعل الرموز والحركات أدناه.",
  tokensTitle: "الرموز — تباين APCA",
  tokensHint:
    "يُحسب تباين كل زوج في المتصفّح (APCA Lc) ويُقارن بالحد الأدنى المستهدف — تمامًا مثل حارس CI.",
  matrixUnavailable: "تعذّر حساب التباين في هذا المتصفّح.",
  motionTitle: "الحركة",
  motionStatusPrefix: "الحركة المخفّضة الآن:",
  motionOn: "نعم",
  motionOff: "لا",
  motionHint: "بدّل محور «الحركة» في اللوحة أعلاه.",
  motionSkeleton: "هيكل تحميل (يتوقّف النبض مع الحركة المخفّضة)",
  motionSpin: "حركة إطارية (تتوقّف مع الحركة المخفّضة)",
  motionFancy: "ينزلق السهم عند التمرير؛ ويتجمّد مع الحركة المخفّضة",
  motionFancyText: "مرّر المؤشّر فوقي",
  motionDialog: "حوار: يبقى تلاشي الشفافية مع الحركة المخفّضة (لا نوقف الانتقالات)",
  motionDialogTrigger: "فتح الحوار",
  motionDialogTitle: "حوار تجريبي",
  motionDialogBody: "يتلاشى الفتح/الإغلاق عبر الشفافية حتى مع الحركة المخفّضة.",
  motionMapNote: "قصور كاميرا الخريطة (three.js) — في /map.",
} satisfies typeof ru;

export default design;
