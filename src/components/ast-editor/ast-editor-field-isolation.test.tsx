import "@testing-library/jest-dom/vitest";
import { Field } from "@base-ui/react/field";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SchemaSnapshot } from "@/components/ast-editor";

// Канарейка: РЕАЛЬНЫЙ AstEditor под внешним <Field name="blocks"> не должен
// засорять FormData — тулбарные kit-контролы (HeadingSelect → Base UI Select)
// не должны наследовать name="blocks". Значение несёт сырой сиблинг-<input>.
// Падает, если изоляция (FieldNameBoundary внутри редактора) сломается / уедет
// в будущем апгрейде Base UI.

// blockLevels.full ОБЯЗАН содержать "heading": иначе HeadingSelect (источник
// утечки name) не смонтируется и тест выродится в тавтологию.
const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "heading"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("./schema-context", () => ({ useSchema: () => snapshot }));
// Серверные picker-actions — мок, чтобы тулбар/меню смонтировались в jsdom.
vi.mock("./pickers/actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { AstEditor } from "./ast-editor";

afterEach(() => { cleanup(); });

describe("AstEditor — изоляция имени поля (FormData не засоряется тулбаром)", () => {
  it("под внешним Field name='blocks' в форме ровно одно поле blocks", () => {
    const { container } = render(
      <form>
        {/* носитель значения — сырой сиблинг-input, как во всех формах */}
        <input type="hidden" name="blocks" defaultValue='[{"type":"paragraph"}]' />
        <Field.Root name="blocks">
          <AstEditor entityContext="document" defaultValue={[]} />
        </Field.Root>
      </form>,
    );
    const blocksFields = container.querySelectorAll("[name='blocks']");
    expect(blocksFields).toHaveLength(1);
  });
});
