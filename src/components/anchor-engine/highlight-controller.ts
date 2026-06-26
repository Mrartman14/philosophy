// src/components/anchor-engine/highlight-controller.ts
// Подсветка через CSS Custom Highlight API (ноль мутаций DOM). Active — отдельный
// слой annotation-active, отличается ВТОРЫМ визуальным каналом (underline в CSS,
// см. globals.css), не только альфой. Нет API → no-op (оверлей-фолбэк отдельно — Task 10).

// Браузерный Highlight — непрозрачный объект (хранилище Range'ей); структура нам не важна.
type HL = object;
type HLCtor = new (...r: Range[]) => HL;

function registry(): Map<string, HL> | null {
  return (globalThis as { CSS?: { highlights?: Map<string, HL> } }).CSS?.highlights ?? null;
}

function ctor(): HLCtor | null {
  return (globalThis as { Highlight?: HLCtor }).Highlight ?? null;
}

export class HighlightController {
  readonly supported: boolean;
  private readonly active: string;

  constructor(private readonly name = "annotation") {
    this.active = `${name}-active`;
    this.supported = registry() !== null && ctor() !== null;
  }

  apply(ranges: Range[]): void {
    const reg = registry();
    const C = ctor();
    if (!reg || !C) return;
    reg.set(this.name, new C(...ranges));
  }

  setActive(range: Range | null): void {
    const reg = registry();
    const C = ctor();
    if (!reg || !C) return;
    if (range) {
      reg.set(this.active, new C(range));
    } else {
      reg.delete(this.active);
    }
  }

  clear(): void {
    const reg = registry();
    if (!reg) return;
    reg.delete(this.name);
    reg.delete(this.active);
  }
}
