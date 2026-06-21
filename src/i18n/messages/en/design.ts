import type ru from "../ru/design";

const design = {
  metaTitle: "Design system",
  appearanceTitle: "Appearance",
  appearanceWarning:
    "Changes your appearance settings on this device (and on your account if you are signed in). This is the real appearance system: toggle the axes and watch the tokens and animations below react.",
  tokensTitle: "Tokens — APCA contrast",
  tokensHint:
    "Each pair's contrast is computed in the browser (APCA Lc) and checked against its target minimum — same as the CI guard.",
  motionTitle: "Motion",
  motionStatusPrefix: "Reduced motion now:",
  motionOn: "YES",
  motionOff: "NO",
  motionHint: "toggle the “Motion” axis in the panel above.",
  motionSkeleton: "Skeleton (pulse stops under reduced)",
  motionSpin: "Keyframe animation (stops under reduced)",
  motionFancy: "Arrow slides on hover; freezes under reduced",
  motionFancyText: "Hover me",
  motionDialog: "Dialog: opacity-fade stays under reduced (we don't kill transitions)",
  motionDialogTrigger: "Open dialog",
  motionDialogTitle: "Demo dialog",
  motionDialogBody: "Open/close still fades by opacity even under reduced motion.",
  motionMapNote: "Map camera inertia (three.js) — at /map.",
} satisfies typeof ru;

export default design;
