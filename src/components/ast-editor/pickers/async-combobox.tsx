"use client";
import { Combobox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { ComboboxResultsStatus } from "./combobox-results-status";
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
          autoFocus: combobox рендерится inline (НЕ в Popup), монтируется уже
          видимым → фокус на mount корректен и восстанавливает поведение старого
          async-combobox (клавиатурные юзеры в canvas/trails/attachments не
          обязаны Tab'ать в поле поиска). Esc-роутинг — через onKeyDown на Input,
          а не onOpenChange: combobox встроен в родительский попап и его
          собственный список обычно закрыт (popup open=false); в закрытом
          состоянии onOpenChange(reason:"escape-key") НЕ срабатывает (нет перехода
          open→closed), тогда как onKeyDown ловит Escape детерминированно и ровно
          один раз — открыт список или нет. (Проверено эмпирически в jsdom с
          @base-ui/react@1.4.1.)
        */}
        {/*
          autoFocus оправдан: combobox рендерится inline и монтируется только как
          намеренно открытая поисковая поверхность (canvas/trails/attachments-пикеры)
          по действию пользователя — это НЕ неожиданный фокус при загрузке страницы.
          Восстанавливает клавиатурный доступ старого async-combobox (без Tab в поле).
        */}
        <Combobox.Input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- inline mount-visible search surface, см. коммент выше
          autoFocus
          placeholder={props.placeholder}
          onKeyDown={(e) => { if (e.key === "Escape") props.onClose?.(); }}
        />
        <Combobox.List className="max-h-[min(60vh,24rem)] overflow-y-auto [&_[role=option]]:line-clamp-2">
          {(item: T) => (
            <Combobox.Item key={props.getKey(item)} value={item}>
              {props.renderItem(item)}
            </Combobox.Item>
          )}
        </Combobox.List>
        <ComboboxResultsStatus
          status={status}
          canLoadMore={canLoadMore}
          onReload={() => { reload(); }}
          onLoadMore={() => { loadMore(); }}
          copy={{
            empty,
            loading: loadingCopy,
            error: errorCopy,
            retry: t("comboboxRetry"),
            loadMore: t("comboboxLoadMore"),
          }}
        />
      </div>
    </Combobox.Root>
  );
}
