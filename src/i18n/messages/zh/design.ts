// src/i18n/messages/zh/design.ts
const design = {
  metaTitle: "设计系统",
  appearanceTitle: "外观",
  appearanceWarning:
    "更改你在本设备上的外观设置（如果你已登录，也会同步到你的账户）。这是真实的 appearance 系统：切换各个轴，观察下方的令牌和动画如何响应。",
  tokensTitle: "令牌 — APCA 对比度",
  tokensHint:
    "每一对的对比度都在浏览器中计算（APCA Lc），并与其目标最小值进行校验——与 CI 守卫一致。",
  matrixUnavailable: "无法在此浏览器中计算对比度。",
  motionTitle: "动效",
  motionStatusPrefix: "当前 Reduced motion：",
  motionOn: "是",
  motionOff: "否",
  motionHint: "在上方面板中切换“动效”轴。",
  motionSkeleton: "Skeleton（在 reduced 下脉冲停止）",
  motionSpin: "Keyframe 动画（在 reduced 下停止）",
  motionFancy: "箭头在悬停时滑动；在 reduced 下静止",
  motionFancyText: "悬停我",
  motionDialog: "对话框：透明度淡入淡出在 reduced 下保留（我们不会关闭过渡效果）",
  motionDialogTrigger: "打开对话框",
  motionDialogTitle: "演示对话框",
  motionDialogBody: "即使在 reduced motion 下，打开/关闭仍会通过透明度淡入淡出。",
  motionMapNote: "地图相机惯性（three.js）——在 /map。",
};

export default design;
