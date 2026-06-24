"use client";
import { Button, Combobox } from "@/components/ui";

export interface ComboboxResultsStatusCopy {
  empty: string;
  loading: string;
  error: string;
  retry: string;
  loadMore: string;
}

export interface ComboboxResultsStatusProps {
  status: "loading" | "error" | "empty" | "ready";
  canLoadMore: boolean;
  onReload: () => void;
  onLoadMore: () => void;
  copy: ComboboxResultsStatusCopy;
}

/**
 * Презентационный футер состояний результата для асинхронного combobox: пусто /
 * загрузка / ошибка(+retry) / «загрузить ещё». Извлечён из AsyncCombobox и
 * RefPicker (они рендерили байт-в-байт идентичный блок) — единая точка истины.
 *
 * Combobox.Empty/Combobox.Status (Base UI, через kit) рендерят children inline
 * даже без Popup/Positioner-предка и дают бесплатные role="status" +
 * aria-live="polite" анонсы для SR. Видимостью рулит вызывающий через свой
 * `status` (серверный поиск, filter=null) — live-region берём от нативных частей.
 * «Загрузить ещё» — обычный интерактивный футер, НЕ внутри Empty/Status (это не
 * статус, а действие; внутри live-region он озвучивался бы как анонс).
 */
export function ComboboxResultsStatus(props: ComboboxResultsStatusProps) {
  const { status, canLoadMore, onReload, onLoadMore, copy } = props;
  return (
    <>
      {status === "empty" && <Combobox.Empty>{copy.empty}</Combobox.Empty>}
      {status === "loading" && <Combobox.Status>{copy.loading}</Combobox.Status>}
      {status === "error" && (
        <Combobox.Status>
          {copy.error}
          <Button tone="quiet" compact onClick={onReload}>{copy.retry}</Button>
        </Combobox.Status>
      )}
      {canLoadMore && (
        <div role="presentation">
          <Button tone="quiet" compact onClick={onLoadMore}>{copy.loadMore}</Button>
        </div>
      )}
    </>
  );
}
