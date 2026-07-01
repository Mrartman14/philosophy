"use client";
// src/features/annotations/ui/document-annotation-layer.tsx
// Коннектор движок↔домен (client). Связывает доменно-агностичный движок
// маргиналий (@/components/anchor-engine) с доменом аннотаций. КРИТИЧНЫЙ
// SSR-инвариант: якорённые карточки рендерятся обычным списком при ready=false
// (server-проход / no-JS) — они ЕСТЬ в HTML (SEO/доступность). После mount
// (ready=true) те же ноды отдаются в MarginAnchorLayer, который ПОЗИЦИОНИРУЕТ их
// у фрагмента и включает подсветку — это улучшение, а не создание контента.
// Hydration-безопасность: первый client-рендер тоже ready=false (совпадает с
// SSR), ready=true приходит следующим тиком из эффекта — без mismatch.
//
// Guardrail 4: client-коннектор импортит ТОЛЬКО pure-фасады (../anchor —
// type+fn, ../types — типы), движок, kit, i18n/client и composer-диалог. НЕ
// тянет server-only ../api/../actions/../permissions/../schemas.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  MarginAnchorLayer,
  type AnchorDraft,
  type AnchoredNote,
} from "@/components/anchor-engine";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { fromEngineAnchor, toEngineAnchor } from "../anchor";
import type { Anchor } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";

interface NoteVM {
  id: string;
  anchor: Anchor | undefined;
  card: ReactNode;
}

interface Props {
  parentId: string;
  notes: NoteVM[];
  canCreate: boolean;
}

const KEY = "annotation-highlights";

export function DocumentAnnotationLayer({ parentId, notes, canCreate }: Props) {
  const t = useT("annotations");
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({
    open: false,
  });

  // Discover AST-рут + восстановить reading-mode тумблер. Запускается ПОСЛЕ
  // первого коммита → SSR/первый client-рендер видят ready=false (no mismatch),
  // улучшение включается следующим тиком.
  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount read of static localStorage pref; SSR/no-JS default is on
    if (window.localStorage.getItem(KEY) === "off") setHighlight(false);
    setReady(true);
  }, []);

  const toggle = () => {
    setHighlight((h) => {
      const next = !h;
      window.localStorage.setItem(KEY, next ? "on" : "off");
      return next;
    });
  };

  // Доменные ноты → движковые: только валидные text-range якоря (media/неполные
  // → null, отсеиваются flatMap). Карточки без движкового якоря рендерятся
  // обычным серверным списком (ssrOnly), всегда. Мемоизация по notes:
  // MarginAnchorLayer держит notes в deps useAnchorRanges (иначе новая
  // идентичность каждый рендер → перерегистрация listeners + форс-пересчёт
  // геометрии). Паритет с document-comment-layer.
  const engineNotes: AnchoredNote[] = useMemo(
    () =>
      notes.flatMap((n) => {
        const engine = n.anchor ? toEngineAnchor(n.anchor) : null;
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const cardById = useMemo(() => new Map(notes.map((n) => [n.id, n.card])), [notes]);
  const engineIds = useMemo(() => new Set(engineNotes.map((n) => n.id)), [engineNotes]);
  const ssrOnly = useMemo(() => notes.filter((n) => !engineIds.has(n.id)), [notes, engineIds]);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      <Inline gap="tight" align="start">
        {canCreate && (
          <Button
            type="button"
            compact
            tone="primary"
            onClick={() => {
              setComposer({ open: true });
            }}
          >
            {t("marginAddUnanchored")}
          </Button>
        )}
        <Button type="button" compact tone="quiet" onClick={toggle}>
          {highlight ? t("marginHighlightToggleOn") : t("marginHighlightToggleOff")}
        </Button>
      </Inline>

      {/* SSR-фолбэк: карточки без движкового якоря (media/без якоря/невалидные) —
          всегда серверным списком, чтобы контент был в HTML. */}
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.card}</div>
      ))}

      {/* Якорённые: на сервере / до mount — простой список (есть в HTML); после
          ready тот же набор отдаём в MarginAnchorLayer, который их позиционирует
          у фрагмента и подсвечивает. Контент НЕ прячется за mounted-флагом. */}
      {!ready ? (
        engineNotes.map((n) => <div key={n.id}>{cardById.get(n.id)}</div>)
      ) : (
        <MarginAnchorLayer
          astRootRef={astRootRef}
          notes={engineNotes}
          renderNote={(n, orphan) => (
            <>
              {orphan && (
                <p className="text-xs text-(--color-fg-muted)">
                  {t("marginOrphanLabel")}
                </p>
              )}
              {cardById.get(n.id) ?? null}
            </>
          )}
          highlightEnabled={highlight}
          canCreate={canCreate}
          onCreateRequest={(d: AnchorDraft) => {
            setComposer({ open: true, anchor: fromEngineAnchor(d.anchor) });
          }}
          affordanceLabel={t("marginAddButton")}
        />
      )}

      <AnnotationComposerDialog
        parentId={parentId}
        open={composer.open}
        onOpenChange={(open) => {
          setComposer((c) => ({ ...c, open }));
        }}
        anchor={composer.anchor}
      />
    </div>
  );
}
