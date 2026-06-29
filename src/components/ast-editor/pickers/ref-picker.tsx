"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Combobox, Tooltip } from "@/components/ui";
import { useT } from "@/i18n/client";

import { ComboboxResultsStatus } from "./combobox-results-status";
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
  /** Тултип для триггер-кнопки (только тулбарный путь; @-меню без подсказки). */
  tooltip?: React.ReactNode;
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
    const id = active.getKey(item);
    // Пустой id = «мёртвая» ссылка (glossary_ref/… c id:"" никуда не ведёт):
    // не вставляем марку, просто закрываем попап. Сюда обычно не доходим, т.к.
    // id-less элементы отфильтрованы из списка ниже, но это последний барьер.
    if (!id) {
      props.onOpenChange(false);
      return;
    }
    props.onWillInsert?.();
    const label = active.getLabel(item);
    const editor = props.editor;
    if (editor.state.selection.empty) {
      // Collapsed — вставляем label-текст с маркой (иначе setMark уходит только в
      // storedMarks и пользователь не видит видимой nav-ref). Поведение локального
      // insertRef: текст-метка + nav-ref марка на ней (раньше — ref-menu.apply).
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

  // Отбрасываем элементы с пустым id: вставлять «мёртвую» ссылку нельзя
  // (insertRef всё равно забракует), а одинаковые пустые key дают React
  // duplicate-key warning при >1 таком элементе.
  const visibleItems = list.items.filter((item) => getKey(item) !== "");

  // Ремоунт Combobox.Root на смене scope — иначе внутренняя selected-value/highlight
  // Base UI протекает между категориями (stale объект → getKey по чужой форме).
  const scopeKey = `${activeId}:${parentId ?? ""}`;

  // key={scopeKey} ремоунтит Root на смене категории/drill-in → фокус слетает на
  // <body>. Возвращаем его в поле поиска после ремоунта (эффект кейован на
  // scopeKey: после remount-commit ref указывает уже на новый input). Защита от
  // протечки scope (через key) сохранена — лечим только потерю фокуса.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.open) inputRef.current?.focus();
  }, [scopeKey, props.open]);

  return (
    <Combobox.Root
      key={scopeKey}
      items={visibleItems as readonly unknown[]}
      filter={null}
      open={props.open}
      // RefPicker сам владеет попапом, поэтому Esc приходит сюда как
      // onOpenChange(open:false, reason:"escape-key") — закрытие через него
      // (в отличие от AsyncCombobox, который встроен inline и ловит Esc через
      // onKeyDown на Input, т.к. его список обычно закрыт и перехода open→closed нет).
      onOpenChange={(open) => { props.onOpenChange(open); }}
      inputValue={list.query}
      onInputValueChange={(v) => { list.setQuery(v); }}
      onValueChange={onValueChange}
      isItemEqualToValue={(a, b) => getKey(a) === getKey(b)}
    >
      {props.trigger ? (
        <Tooltip content={props.tooltip}>
          <Combobox.Trigger render={props.trigger as React.ReactElement} />
        </Tooltip>
      ) : null}
      <Combobox.Portal>
        <Combobox.Positioner
          {...(props.anchor ? { anchor: props.anchor } : {})}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Combobox.Popup
            className="ref-picker p-1 min-w-[320px] max-w-[480px]"
            aria-label={t("insertRefDialogAriaLabel")}
          >
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
            <Combobox.Input ref={inputRef} placeholder={placeholder} />
            <Combobox.List className="max-h-[min(60vh,24rem)] overflow-y-auto [&_[role=option]]:line-clamp-2">
              {(item: unknown) => (
                <Combobox.Item key={getKey(item)} value={item}>{renderItem(item)}</Combobox.Item>
              )}
            </Combobox.List>
            <ComboboxResultsStatus
              status={list.status}
              canLoadMore={list.canLoadMore}
              onReload={() => { list.reload(); }}
              onLoadMore={() => { list.loadMore(); }}
              copy={{
                empty: t("comboboxEmpty"),
                loading: t("comboboxLoading"),
                error: t("comboboxError"),
                retry: t("comboboxRetry"),
                loadMore: t("comboboxLoadMore"),
              }}
            />
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
