"use client";
import { Button, Combobox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { useAsyncComboboxItems, type AsyncFetcher } from "./use-async-combobox-items";

export interface AsyncComboboxProps<T> {
  /**
   * ОБЯЗАТЕЛЬНО стабильная ссылка (useCallback / module-const): смена identity =
   * рефетч. Нестабильный (инлайновый) fetcher → БЕСКОНЕЧНЫЙ цикл фетчей (не просто
   * лишний запрос): хук пересоздаёт load → effect → setState → ре-рендер → новый fetcher.
   */
  fetcher: AsyncFetcher<T>;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  /** Вызывается при Esc внутри combobox. */
  onClose?: () => void;
  placeholder?: string;
  pageSize?: number;
  copy?: { empty?: string; error?: string; loading?: string };
}

/**
 * Универсальный асинхронный combobox поверх kit `Combobox` (Base UI) и хука
 * `useAsyncComboboxItems`. Серверный поиск (`filter={null}` — клиентская фильтрация
 * отключена), пагинация «загрузить ещё», состояния loading/empty/error+retry.
 * Рендерит self-contained inline-список (без собственного Portal) — встраивается в
 * родительский попап/диалог. Внешний API сохранён ради zero-change consumers.
 */
export function AsyncCombobox<T>(props: AsyncComboboxProps<T>) {
  const t = useT("editor");
  const pageSize = props.pageSize ?? 20;
  const empty = props.copy?.empty ?? t("comboboxEmpty");
  const errorCopy = props.copy?.error ?? t("comboboxError");
  const loadingCopy = props.copy?.loading ?? t("comboboxLoading");

  const { items, status, query, setQuery, loadMore, canLoadMore, reload } =
    useAsyncComboboxItems<T>(props.fetcher, pageSize);

  return (
    <Combobox.Root
      items={items as readonly T[]}
      filter={null}
      inputValue={query}
      onInputValueChange={(v) => { setQuery(v); }}
      onValueChange={(value) => { if (value != null) props.onSelect(value as T); }}
      isItemEqualToValue={(a, b) => props.getKey(a as T) === props.getKey(b as T)}
    >
      <div className="async-combobox">
        {/*
          Esc-роутинг через onKeyDown на Input, а не onOpenChange: combobox
          встраивается inline в родительский попап и его собственный список,
          как правило, закрыт (popup open=false). В закрытом состоянии
          onOpenChange(reason:"escape-key") НЕ срабатывает (нет перехода
          open→closed), тогда как onKeyDown ловит Escape детерминированно
          и ровно один раз — открыт список или нет. (Проверено эмпирически
          в jsdom с @base-ui/react@1.4.1.)
        */}
        <Combobox.Input
          placeholder={props.placeholder}
          onKeyDown={(e) => { if (e.key === "Escape") props.onClose?.(); }}
        />
        <Combobox.List>
          {(item: T) => (
            <Combobox.Item key={props.getKey(item)} value={item}>
              {props.renderItem(item)}
            </Combobox.Item>
          )}
        </Combobox.List>
        {/*
          Combobox.Empty/Combobox.Status (Base UI, через kit) рендерят children
          inline даже без Popup/Positioner-предка и дают бесплатные
          role="status" + aria-live="polite" анонсы — манипулировать видимостью
          продолжаем через наш status (серверный поиск, filter=null), но a11y
          live-region берём от нативных частей.
        */}
        {status === "empty" && <Combobox.Empty>{empty}</Combobox.Empty>}
        {status === "loading" && <Combobox.Status>{loadingCopy}</Combobox.Status>}
        {status === "error" && (
          <Combobox.Status>
            {errorCopy}
            <Button tone="quiet" compact onClick={() => { reload(); }}>{t("comboboxRetry")}</Button>
          </Combobox.Status>
        )}
        {canLoadMore && (
          <div role="presentation">
            <Button tone="quiet" compact onClick={() => { loadMore(); }}>{t("comboboxLoadMore")}</Button>
          </div>
        )}
      </div>
    </Combobox.Root>
  );
}
