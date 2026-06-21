// src/app/_offline/save-offline-button.tsx
"use client";

import { useEffect, useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { whenIdentityReconciled } from "@/services/offline/identity-gate";
import {
  deleteSavedBundle,
  getSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedBundle } from "./revalidate-saved-bundle";
import { saveOffline } from "./save-offline";

type ViewState =
  | { kind: "unknown" }
  | { kind: "not-saved" }
  | { kind: "saving" }
  | { kind: "saved"; stale: boolean }
  | { kind: "updating" }
  | { kind: "removing" };

/** Generic stateful-кнопка офлайн-сохранения для любой сущности из OFFLINE_REGISTRY. */
export function SaveOfflineButton({
  entity,
  id,
}: {
  entity: string;
  id: string;
}) {
  const [state, setState] = useState<ViewState>({ kind: "unknown" });
  const toast = useToast();
  const t = useT("pages");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Не показываем чужое сохранённое состояние до сверки личности.
      await whenIdentityReconciled();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      const rec = await getSavedBundle(entity, id);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      if (rec?.status !== "complete") {
        setState({ kind: "not-saved" });
        return;
      }
      setState({ kind: "saved", stale: rec.remoteStatus === "stale" });
      // Фоновая сверка свежести (SWR); офлайн — пропускаем (best-effort).
      if (navigator.onLine) {
        const outcome = await revalidateSavedBundle(entity, id);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
        if (cancelled) return;
        if (outcome !== "skip") {
          const refreshed = await getSavedBundle(entity, id);
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
          if (cancelled) return;
          setState(
            refreshed?.status === "complete"
              ? { kind: "saved", stale: refreshed.remoteStatus === "stale" }
              : { kind: "not-saved" },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity, id]);

  // saving — из not-saved; updating — из saved-stale («Обновить»).
  const doSave = (transient: "saving" | "updating"): void => {
    setState({ kind: transient });
    void saveOffline(entity, id).then((result) => {
      if (result.ok) {
        setState({ kind: "saved", stale: false });
        toast.add({
          title: t("saveOfflineSuccessTitle"),
          description: result.warning,
        });
      } else {
        // Откат: из save → not-saved; из update → копия осталась устаревшей.
        setState(
          transient === "saving"
            ? { kind: "not-saved" }
            : { kind: "saved", stale: true },
        );
        toast.add({
          title: t("saveOfflineFailTitle"),
          description: result.error,
        });
      }
    });
  };

  const doRemove = async (): Promise<void> => {
    setState({ kind: "removing" });
    try {
      await deleteSavedBundle(entity, id);
    } catch {
      // Сбой IDB-delete: не залипаем в "removing" — восстанавливаем актуальное
      // состояние копии (она ещё на устройстве) и сообщаем об ошибке.
      const rec = await getSavedBundle(entity, id);
      setState(
        rec?.status === "complete"
          ? { kind: "saved", stale: rec.remoteStatus === "stale" }
          : { kind: "not-saved" },
      );
      toast.add({ title: t("saveOfflineRemoveFailTitle") });
      return;
    }
    setState({ kind: "not-saved" });
    toast.add({ title: t("saveOfflineRemovedToast") });
  };

  const removeButton = (
    <ConfirmDialog
      trigger={
        <Button type="button" tone="quiet">
          {t("saveOfflineRemove")}
        </Button>
      }
      title={t("saveOfflineRemoveConfirmTitle")}
      description={t("saveOfflineRemoveConfirmBody")}
      confirmLabel={t("saveOfflineRemoveConfirmAction")}
      destructive
      onConfirm={doRemove}
    />
  );

  if (state.kind === "unknown") {
    return (
      <Button type="button" tone="neutral" disabled>
        {t("saveOfflineButton")}
      </Button>
    );
  }
  if (state.kind === "not-saved") {
    return (
      <Button type="button" tone="neutral" onClick={() => { doSave("saving"); }}>
        {t("saveOfflineButton")}
      </Button>
    );
  }
  if (state.kind === "saving") {
    return (
      <Button type="button" tone="neutral" disabled>
        {t("saveOfflineSaving")}
      </Button>
    );
  }
  if (state.kind === "updating") {
    return (
      <Button type="button" tone="neutral" disabled>
        {t("saveOfflineUpdating")}
      </Button>
    );
  }
  if (state.kind === "removing") {
    return (
      <Button type="button" tone="quiet" disabled>
        {t("saveOfflineRemoving")}
      </Button>
    );
  }
  // state.kind === "saved"
  return (
    <div className="flex items-center gap-3">
      {state.stale ? (
        <>
          <span className="text-sm text-(--color-fg-muted)">
            {t("saveOfflineUpdateAvailable")}
          </span>
          <Button
            type="button"
            tone="neutral"
            onClick={() => { doSave("updating"); }}
          >
            {t("saveOfflineUpdate")}
          </Button>
        </>
      ) : (
        <span className="text-sm text-(--color-fg-muted)">
          {t("savedLectureSavedBadge")}
        </span>
      )}
      {removeButton}
    </div>
  );
}
