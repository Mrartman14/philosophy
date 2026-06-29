"use client";
import { AlignJustifyIcon } from "@/assets/icons/align-justify-icon";
import { AlignStartIcon } from "@/assets/icons/align-start-icon";
import { useAppearance } from "@/components/appearance";
import { FormField, RadioGroup, Tooltip } from "@/components/ui";
import { useT } from "@/i18n/client";
import { type TextSize } from "@/styles/tokens/enums";
import { TEXT_SCALE } from "@/styles/tokens/scales";
import { withViewTransition } from "@/utils/view-transition";

export function AppearanceSettings() {
  const { appearance, setAxis } = useAppearance();
  const t = useT("settings");

  const THEME = [
    { value: "system", label: t("appearance.theme.system") },
    { value: "light", label: t("appearance.theme.light") },
    { value: "dark", label: t("appearance.theme.dark") },
  ];
  const CONTRAST = [
    { value: "auto", label: t("appearance.contrast.auto") },
    { value: "normal", label: t("appearance.contrast.normal") },
    { value: "high", label: t("appearance.contrast.high") },
  ];
  const DENSITY = [
    { value: "comfortable", label: t("appearance.density.comfortable") },
    { value: "compact", label: t("appearance.density.compact") },
  ];
  const FONT = [
    { value: "sans", label: t("appearance.font.sans") },
    { value: "legible", label: t("appearance.font.legible") },
    { value: "serif", label: t("appearance.font.serif") },
  ];
  // Каждый сегмент — глиф «Aa» в масштабе своего размера (визуальный превью),
  // доступным именем остаётся локализованный текст-метка (см. RadioGroup.content).
  const TEXT_SIZE = [
    { value: "sm", label: t("appearance.textSize.sm") },
    { value: "md", label: t("appearance.textSize.md") },
    { value: "lg", label: t("appearance.textSize.lg") },
    { value: "xl", label: t("appearance.textSize.xl") },
  ].map((o) => ({
    ...o,
    content: (
      <span title={o.label} className="leading-none" style={{ fontSize: `${TEXT_SCALE[o.value as TextSize]}rem` }}>
        Aa
      </span>
    ),
  }));
  const MOTION = [
    { value: "system", label: t("appearance.motion.system") },
    { value: "reduced", label: t("appearance.motion.reduced") },
    { value: "full", label: t("appearance.motion.full") },
  ];
  // Сегменты — иконки выравнивания (align-start/justify); доступным именем остаётся
  // локализованный текст-метка (sr-only, см. RadioGroup.content). Подсказка — kit-
  // Tooltip; ряд сегментов сгруппирован Tooltip.Provider'ом (первый показ ждёт
  // задержку, соседний — мгновенно).
  const TEXT_ALIGN = [
    { value: "start", label: t("appearance.textAlign.start"), icon: <AlignStartIcon /> },
    { value: "justify", label: t("appearance.textAlign.justify"), icon: <AlignJustifyIcon /> },
  ].map((o) => ({
    value: o.value,
    label: o.label,
    content: (
      <Tooltip content={o.label}>
        <span className="inline-flex text-base leading-none">{o.icon}</span>
      </Tooltip>
    ),
  }));

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("appearance.heading")}</h2>
      <Row name="theme" label={t("appearance.themeLabel")}><RadioGroup aria-label={t("appearance.themeLabel")} options={THEME} value={appearance.theme} onValueChange={(v) => { withViewTransition(() => { setAxis("theme", v as typeof appearance.theme); }); }} /></Row>
      <Row name="contrast" label={t("appearance.contrastLabel")}><RadioGroup aria-label={t("appearance.contrastLabel")} options={CONTRAST} value={appearance.contrast} onValueChange={(v) => { setAxis("contrast", v as typeof appearance.contrast); }} /></Row>
      <Row name="density" label={t("appearance.densityLabel")}><RadioGroup aria-label={t("appearance.densityLabel")} options={DENSITY} value={appearance.density} onValueChange={(v) => { setAxis("density", v as typeof appearance.density); }} /></Row>
      <Row name="font" label={t("appearance.fontLabel")}><RadioGroup aria-label={t("appearance.fontLabel")} options={FONT} value={appearance.font} onValueChange={(v) => { setAxis("font", v as typeof appearance.font); }} /></Row>
      <Row name="textSize" label={t("appearance.textSizeLabel")}><RadioGroup aria-label={t("appearance.textSizeLabel")} options={TEXT_SIZE} value={appearance.textSize} onValueChange={(v) => { setAxis("textSize", v as typeof appearance.textSize); }} /></Row>
      <Row name="motion" label={t("appearance.motionLabel")}><RadioGroup aria-label={t("appearance.motionLabel")} options={MOTION} value={appearance.motion} onValueChange={(v) => { setAxis("motion", v as typeof appearance.motion); }} /></Row>
      <Row name="textAlign" label={t("appearance.textAlignLabel")}><Tooltip.Provider><RadioGroup aria-label={t("appearance.textAlignLabel")} options={TEXT_ALIGN} value={appearance.textAlign} onValueChange={(v) => { setAxis("textAlign", v as typeof appearance.textAlign); }} /></Tooltip.Provider></Row>
    </section>
  );
}
function Row({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
  return <FormField name={name} label={label}>{children}</FormField>;
}
