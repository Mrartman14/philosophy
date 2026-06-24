// src/components/annotation-layer/types.ts
// Доменно-агностичные, но AST-субстрат-специфичные типы движка. НЕ импортируют
// схему аннотаций; обвязка маппит annotation.Anchor ↔ TextAnchor (поля и единицы
// идентичны — UTF-16 code units).
export interface TextAnchor {
  startBlockId: string;
  endBlockId: string;
  startChar: number; // UTF-16 code units
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}
export interface AnchoredNote {
  id: string;
  anchor: TextAnchor;
}
export interface AnchorDraft {
  anchor: TextAnchor;
  rect: DOMRect; // вьюпорт-координаты выделения для тултипа
}
