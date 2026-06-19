"use client";
import { useAppearance } from "@/components/appearance";
import { Select } from "@/components/ui";

const THEME = [{ value: "system", label: "Как в системе" }, { value: "light", label: "Светлая" }, { value: "dark", label: "Тёмная" }];
const CONTRAST = [{ value: "normal", label: "Обычный" }, { value: "high", label: "Высокий" }];
const DENSITY = [{ value: "comfortable", label: "Просторно" }, { value: "compact", label: "Компактно" }];
const FONT = [{ value: "sans", label: "Стандартный" }, { value: "legible", label: "Высоко-разборчивый" }, { value: "serif", label: "С засечками (для чтения)" }];
const TEXT_SIZE = [{ value: "sm", label: "Меньше" }, { value: "md", label: "Обычный" }, { value: "lg", label: "Крупнее" }, { value: "xl", label: "Максимальный" }];

export function AppearanceSettings() {
  const { appearance, setAxis } = useAppearance();
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">Внешний вид</h2>
      <Row label="Тема"><Select aria-label="Тема" options={THEME} value={appearance.theme} onValueChange={(v) => { setAxis("theme", v as typeof appearance.theme); }} /></Row>
      <Row label="Контраст"><Select aria-label="Контраст" options={CONTRAST} value={appearance.contrast} onValueChange={(v) => { setAxis("contrast", v as typeof appearance.contrast); }} /></Row>
      <Row label="Плотность интерфейса"><Select aria-label="Плотность" options={DENSITY} value={appearance.density} onValueChange={(v) => { setAxis("density", v as typeof appearance.density); }} /></Row>
      <Row label="Шрифт"><Select aria-label="Шрифт" options={FONT} value={appearance.font} onValueChange={(v) => { setAxis("font", v as typeof appearance.font); }} /></Row>
      <Row label="Размер текста"><Select aria-label="Размер текста" options={TEXT_SIZE} value={appearance.textSize} onValueChange={(v) => { setAxis("textSize", v as typeof appearance.textSize); }} /></Row>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
