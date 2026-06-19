import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string, params?: Record<string, string | number>) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (params) {
          return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
        }
        return val;
      };
    },
  };
});

import { __resetSchemaCache } from "./schema-cache";
import { SchemaContextProvider, useSchema } from "./schema-context";
import type { SchemaResponse } from "./types";

const SAMPLE: SchemaResponse = {
  block_levels: { full: ["paragraph"] },
  entity_block_limits: { document: 20000 },
  entity_contexts: { document: "full" },
  limits: {
    max_depth: 32,
    max_text_len: 100,
    max_content_items: 10,
    max_marks_per_node: 5,
  },
  url_policy: { dangerous_schemes: ["javascript"] },
  nodes: [{ type: "paragraph", content: ["text"], marks: ["bold"], leaf: false }],
  elements: [{ name: "bold", category: "formatting" }],
  exclusive_categories: ["navigation"],
};

function Probe() {
  const schema = useSchema();
  return (
    <span data-testid="probe">
      {schema.nodes.has("paragraph") ? "has-paragraph" : "no"}
    </span>
  );
}

beforeEach(() => {
  __resetSchemaCache();
  vi.restoreAllMocks();
});
afterEach(cleanup);

describe("SchemaContextProvider", () => {
  it("гидрирует контекст из initial синхронно, без клиентского фетча", () => {
    const fetcher = vi.fn();
    render(
      <SchemaContextProvider
        initial={SAMPLE}
        fetcher={fetcher}
        fallback={<span>loading</span>}
      >
        <Probe />
      </SchemaContextProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("has-paragraph");
    expect(screen.queryByText("loading")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("без initial — забирает схему через fetcher (fallback до резолва)", async () => {
    const fetcher = vi.fn().mockResolvedValue(SAMPLE);
    render(
      <SchemaContextProvider fetcher={fetcher} fallback={<span>loading</span>}>
        <Probe />
      </SchemaContextProvider>,
    );
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("probe").textContent).toBe("has-paragraph");
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
