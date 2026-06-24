"use client";
import type { Editor } from "@tiptap/core";
import { useMemo, useState } from "react";

import { Button, Combobox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { REF_TYPES, type RefTypeDef } from "./ref-types";
import { useAsyncComboboxItems, type AsyncFetcher } from "./use-async-combobox-items";

/** Дегенеративный fetcher (стабильная ссылка): подстраховка, если у global-scope
 * категории нет `fetch` — по конструкции REF_TYPES такого не бывает. */
const EMPTY_FETCHER: AsyncFetcher<unknown> = () => Promise.resolve({ data: [], total: 0 });

export interface RefPickerProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PRIMARY-путь: anchor каретки для @-поверхности (без trigger). */
  anchor?: { getBoundingClientRect: () => DOMRect } | undefined;
  /** Тулбар: триггер-кнопка (Combobox.Trigger). */
  trigger?: React.ReactNode;
  /** Вызывается синхронно перед вставкой марки (AtMenu удаляет "@"-маркер). */
  onWillInsert?: (() => void) | undefined;
}

/**
 * Scoped combobox: один Base UI Combobox-попап, владеющий собственным открытием.
 * Заголовок-переключатель категорий (глоссарий/документ/медиа/комментарий) меняет
 * активный тип ссылки; combobox ищет внутри него. Для `comment` (scope.kind ===
 * "parent") сперва drill-in в лекцию (выбор лекции ставит контекст БЕЗ вставки,
 * показывает крошку), затем ищет комментарии этой лекции. Терминальный выбор
 * вставляет марку и закрывает попап.
 *
 * PRIMARY (подтверждён ревью): RefPicker САМ владеет попапом. Один Combobox.Root,
 * controlled `open`. Тулбар → Combobox.Trigger(props.trigger). "@" → Portal/
 * Positioner anchor={props.anchor}. Тело (категории + крошка + input + список) —
 * внутри Popup.
 */
export function RefPicker(props: RefPickerProps) {
  const t = useT("editor");
  const [activeId, setActiveId] = useState<RefTypeDef<unknown>["id"]>("glossary");
  const [parentId, setParentId] = useState<string | undefined>(props.defaultLectureId);
  const [parentLabel, setParentLabel] = useState<string | undefined>(undefined);

  const active = REF_TYPES.find((r) => r.id === activeId) ?? REF_TYPES[0];
  // REF_TYPES непуст по конструкции (ref-types.ts) — гард для noUncheckedIndexedAccess.
  if (active === undefined) throw new Error("REF_TYPES is empty");
  const inParentStep = active.scope.kind === "parent" && parentId === undefined;

  // Фетчер активного scope: либо global fetch, либо parent (лекции) / child (комменты).
  // ВАЖНО (контракт useAsyncComboboxItems): ссылка должна быть СТАБИЛЬНОЙ —
  // useMemo по [active, inParentStep, parentId], иначе новое замыкание каждый
  // рендер → бесконечный цикл фетчей.
  const fetcher: AsyncFetcher<unknown> = useMemo(() => {
    const scope = active.scope;
    if (scope.kind === "parent") {
      // Узкое сужение по `parentId` (а не по производному `inParentStep`-флагу),
      // чтобы TS снял `undefined` без cast/non-null — оба запрещены линтером.
      return parentId === undefined
        ? (scope.parentFetch as AsyncFetcher<unknown>)
        : (scope.childFetch(parentId) as AsyncFetcher<unknown>);
    }
    // global-scope: fetch обязателен по конструкции REF_TYPES (см. ref-types.ts).
    return active.fetch ?? EMPTY_FETCHER;
  }, [active, parentId]);

  const list = useAsyncComboboxItems<unknown>(fetcher);

  const switchType = (id: RefTypeDef<unknown>["id"]) => {
    setActiveId(id);
    setParentId(id === "comment" ? props.defaultLectureId : undefined);
    setParentLabel(undefined);
    list.setQuery("");
  };

  const insertRef = (item: unknown) => {
    props.onWillInsert?.();
    const id = active.getKey(item);
    const label = active.getLabel(item);
    const editor = props.editor;
    if (editor.state.selection.empty) {
      // Collapsed — вставляем label-текст с маркой (иначе setMark уходит только в
      // storedMarks и пользователь не видит видимой nav-ref). Зеркалит ref-menu.apply().
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: active.mark, attrs: { id } }],
        })
        .run();
    } else {
      editor.chain().focus().setMark(active.mark, { id }).run();
    }
    props.onOpenChange(false);
  };

  const onValueChange = (value: unknown) => {
    if (value == null) return;
    if (inParentStep && active.scope.kind === "parent") {
      // drill-in: выбор лекции ставит контекст, не вставляет, попап открыт.
      // `value` — это Lecture (item parent-шага); `as never` зеркалит каст
      // renderItem/getKey ниже (REF_TYPES стёрт до unknown по элементам).
      setParentId(active.scope.parentKey(value as never));
      setParentLabel(active.scope.crumbLabel(value as never));
      list.setQuery("");
      return;
    }
    insertRef(value);
  };

  const placeholder =
    inParentStep && active.scope.kind === "parent"
      ? t(active.scope.parentPlaceholderKey)
      : t(active.placeholderKey);

  const renderItem = (item: unknown): React.ReactNode =>
    inParentStep && active.scope.kind === "parent"
      ? active.scope.parentRender(item as never)
      : active.renderItem(item);
  const getKey = (item: unknown): string =>
    inParentStep && active.scope.kind === "parent"
      ? active.scope.parentKey(item as never)
      : active.getKey(item);

  // Ремоунт Combobox.Root на смене scope — иначе внутренняя selected-value/highlight
  // Base UI протекает между категориями (stale объект → getKey по чужой форме).
  const scopeKey = `${activeId}:${parentId ?? ""}`;

  return (
    <Combobox.Root
      key={scopeKey}
      items={list.items as readonly unknown[]}
      filter={null}
      open={props.open}
      onOpenChange={(open) => { props.onOpenChange(open); }}
      inputValue={list.query}
      onInputValueChange={(v) => { list.setQuery(v); }}
      onValueChange={onValueChange}
      isItemEqualToValue={(a, b) => getKey(a) === getKey(b)}
    >
      {props.trigger ? <Combobox.Trigger render={props.trigger as React.ReactElement} /> : null}
      <Combobox.Portal>
        <Combobox.Positioner
          {...(props.anchor ? { anchor: props.anchor } : {})}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Combobox.Popup className="ref-picker p-1 min-w-[320px] max-w-[480px]">
            <div role="group" aria-label={t("refCategoryAriaLabel")} className="flex gap-1 p-1">
              {REF_TYPES.map((r) => (
                <Button
                  key={r.id}
                  type="button"
                  aria-pressed={activeId === r.id}
                  tone={activeId === r.id ? "primary" : "neutral"}
                  onClick={() => { switchType(r.id); }}
                >
                  {t(r.labelKey)}
                </Button>
              ))}
            </div>
            {active.scope.kind === "parent" && parentId !== undefined && (
              <Button
                tone="quiet"
                compact
                onClick={() => { setParentId(undefined); setParentLabel(undefined); list.setQuery(""); }}
              >
                {t("refLectureCrumb", { title: parentLabel ?? "" })}
              </Button>
            )}
            <Combobox.Input placeholder={placeholder} />
            <Combobox.List>
              {(item: unknown) => (
                <Combobox.Item key={getKey(item)} value={item}>{renderItem(item)}</Combobox.Item>
              )}
            </Combobox.List>
            {/*
              Combobox.Empty/Combobox.Status (Base UI, через kit) дают бесплатные
              role="status" + aria-live="polite" анонсы для SR — видимостью рулим
              нашим status (серверный поиск, filter=null), live-region берём от частей.
            */}
            {list.status === "empty" && <Combobox.Empty>{t("comboboxEmpty")}</Combobox.Empty>}
            {list.status === "loading" && <Combobox.Status>{t("comboboxLoading")}</Combobox.Status>}
            {list.status === "error" && (
              <Combobox.Status>
                {t("comboboxError")}
                <Button tone="quiet" compact onClick={() => { list.reload(); }}>{t("comboboxRetry")}</Button>
              </Combobox.Status>
            )}
            {list.canLoadMore && (
              <div role="presentation">
                <Button tone="quiet" compact onClick={() => { list.loadMore(); }}>{t("comboboxLoadMore")}</Button>
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
