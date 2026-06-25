"use client";
// src/features/lectures/ui/lecture-document-tabs.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AstRender } from "@/components/ast-render";
import type { AstBlock } from "@/components/ast-render";
import { Tabs } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

export interface DocTabMeta {
  id: string;
  label: string;
}

interface Props {
  docs: DocTabMeta[];
  /** id активной по умолчанию вкладки (основной документ). */
  primaryId: string;
  /** Серверно-отрисованное тело основного документа (без доп. запроса). */
  primaryPanel: ReactNode;
  /** Ленивая загрузка тела неосновного документа по id. */
  loadBlocks: (docId: string) => Promise<ActionResult<AstBlock[]>>;
}

/**
 * Вкладки документов лекции. Грузится тело только активного: основной отрисован
 * сервером (primaryPanel), остальные — лениво при первой активации, с кэшем тел
 * в состоянии родителя (переживает размонтирование панели при keepMounted=false).
 */
export function LectureDocumentTabs({ docs, primaryId, primaryPanel, loadBlocks }: Props) {
  const tL = useT("lectures");
  const [cache, setCache] = useState<Record<string, AstBlock[]>>({});

  return (
    <Tabs.Root defaultValue={primaryId}>
      <Tabs.List aria-label={tL("documentTabsAriaLabel")}>
        {docs.map((d) => (
          <Tabs.Tab key={d.id} value={d.id} title={d.label}>
            {d.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {docs.map((d) => (
        <Tabs.Panel key={d.id} value={d.id}>
          {d.id === primaryId ? (
            primaryPanel
          ) : (
            <LazyDocPanel
              docId={d.id}
              cached={cache[d.id]}
              loadBlocks={loadBlocks}
              onLoaded={(blocks) => {
                setCache((c) => ({ ...c, [d.id]: blocks }));
              }}
            />
          )}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; blocks: AstBlock[] }
  | { status: "error" };

function LazyDocPanel({
  docId,
  cached,
  loadBlocks,
  onLoaded,
}: {
  docId: string;
  cached: AstBlock[] | undefined;
  loadBlocks: (docId: string) => Promise<ActionResult<AstBlock[]>>;
  onLoaded: (blocks: AstBlock[]) => void;
}) {
  const tL = useT("lectures");
  const [state, setState] = useState<LoadState>(
    cached ? { status: "ready", blocks: cached } : { status: "loading" },
  );

  useEffect(() => {
    if (cached) {
      setState({ status: "ready", blocks: cached });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    void loadBlocks(docId).then((r) => {
      if (!alive) return;
      if (r.success) {
        setState({ status: "ready", blocks: r.data });
        onLoaded(r.data);
      } else {
        setState({ status: "error" });
      }
    });
    return () => {
      alive = false;
    };
    // onLoaded стабилен в рамках жизни родителя; реальные триггеры — docId/cached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, cached]);

  // Состояния анонсируются скринридеру (role=status/alert), как form-feedback.tsx:
  // контент вкладки меняется асинхронно при активации.
  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-(--color-fg-muted)">
        {tL("docTabLoading")}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-(--color-danger-fg)">
        {tL("docTabError")}
      </p>
    );
  }
  return (
    <article className="content">
      {state.blocks.length === 0 ? (
        <p role="status" className="text-sm text-(--color-fg-muted)">
          {tL("docTabEmpty")}
        </p>
      ) : (
        <AstRender blocks={state.blocks} />
      )}
    </article>
  );
}
