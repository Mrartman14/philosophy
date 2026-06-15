// src/app/saved/saved-lecture-view.tsx
"use client";

import { useEffect, useState } from "react";

import type { LectureSnapshot } from "@/app/_offline/descriptors/lecture-descriptor";
import { revalidateSavedLecture } from "@/app/_offline/revalidate-saved-lecture";
import { saveOffline } from "@/app/_offline/save-offline";
import { AstRender } from "@/components/ast-render";
import { Button, Skeleton } from "@/components/ui";
import { CommentTreeView } from "@/features/comments/client";
import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import { whenIdentityReconciled } from "@/services/offline/identity-gate";
import { getSavedBundle } from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "incomplete"; status: string; error: string | undefined }
  | { kind: "corrupt" }
  | {
      kind: "ready";
      snapshot: LectureSnapshot;
      savedAt: string;
      remoteStatus?: "stale" | "gone";
    };

// Снимок в сторе — unknown; рантайм-валидация минимальной формы перед рендером.
function isLectureSnapshot(s: unknown): s is LectureSnapshot {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  const lecture = o.lecture;
  return (
    typeof lecture === "object" &&
    lecture !== null &&
    typeof (lecture as Record<string, unknown>).title === "string" &&
    Array.isArray(o.tags) &&
    Array.isArray(o.documents) &&
    Array.isArray(o.comments)
  );
}

async function loadState(id: string): Promise<LoadState> {
  const rec = await getSavedBundle("lectures", id);
  if (!rec) return { kind: "missing" };
  if (rec.status !== "complete") {
    return { kind: "incomplete", status: rec.status, error: rec.error };
  }
  // Несовместимая версия формы или битый снимок → один и тот же экран
  // «повреждён или устарел — сохраните заново».
  if (
    rec.schemaVersion !== OFFLINE_SCHEMA_VERSION ||
    !isLectureSnapshot(rec.snapshot)
  ) {
    return { kind: "corrupt" };
  }
  return {
    kind: "ready",
    snapshot: rec.snapshot,
    savedAt: rec.savedAt,
    // условный spread: под exactOptionalPropertyTypes нельзя присвоить
    // optional-полю значение, которое может быть undefined.
    ...(rec.remoteStatus ? { remoteStatus: rec.remoteStatus } : {}),
  };
}

export function SavedLectureView({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Не показываем снимок прежнего владельца до сверки личности (см. identity-gate).
      await whenIdentityReconciled();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      const next = await loadState(id);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      setState(next);
      // Фоновая ревалидация (SWR): снимок уже показан выше, сверка его не
      // блокирует. Один раз на id; офлайн — не сверяем (best-effort).
      if (next.kind === "ready" && navigator.onLine) {
        const outcome = await revalidateSavedLecture(id);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
        if (cancelled) return;
        if (outcome !== "skip") {
          // Перечитываем запись, чтобы отразить проставленную/снятую пометку.
          setState(await loadState(id));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // «Обновить» — пере-сохранить свежий снимок из сети (работает только онлайн);
  // при сбое показываем инлайн-сообщение, не теряя уже показанный снимок.
  const onRefresh = (): void => {
    setRefreshing(true);
    setRefreshError(null);
    void saveOffline("lectures", id).then(async (res) => {
      if (res.ok) {
        setState(await loadState(id));
      } else {
        setRefreshError(res.error ?? "Не удалось обновить — проверьте подключение.");
      }
      setRefreshing(false);
    });
  };

  if (state.kind === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }
  if (state.kind === "missing") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        Эта лекция не сохранена офлайн.
      </p>
    );
  }
  if (state.kind === "incomplete") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        {state.status === "saving"
          ? "Лекция ещё сохраняется…"
          : `Сохранение не завершено: ${state.error ?? "ошибка"}.`}
      </p>
    );
  }
  if (state.kind === "corrupt") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        Сохранённый снимок повреждён или устарел — откройте лекцию онлайн и сохраните заново.
      </p>
    );
  }

  const { lecture, tags, documents, comments } = state.snapshot;
  const remoteStatus = state.remoteStatus;
  const coverUrl = lecture.cover_image_key
    ? resolveStorageUrl(lecture.cover_image_key)
    : null;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {remoteStatus === "gone" && (
        <p
          className="rounded-md border border-(--color-border) p-3 text-sm text-(--color-description)"
          role="status"
        >
          Эта лекция удалена с платформы. У вас осталась сохранённая копия.
        </p>
      )}
      {remoteStatus === "stale" && (
        <p
          className="rounded-md border border-(--color-border) p-3 text-sm text-(--color-description)"
          role="status"
        >
          Доступна обновлённая версия — нажмите «Обновить».
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-(--color-description)">
          Сохранено офлайн:{" "}
          {new Date(state.savedAt).toLocaleDateString("ru-RU", {
            timeZone: "UTC",
          })}
        </span>
        {remoteStatus !== "gone" && (
          <Button
            type="button"
            variant="secondary"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing ? "Обновление…" : "Обновить"}
          </Button>
        )}
      </div>
      {refreshError && (
        <p className="text-sm text-(--color-description)" role="alert">
          {refreshError}
        </p>
      )}

      <header className="flex flex-col gap-2">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={lecture.cover_image_alt ?? ""}
            className="max-h-80 w-full rounded-lg object-cover"
          />
        )}
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-sm text-(--color-description)">{lecture.date}</p>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <li
                key={t.name}
                className="rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description)"
              >
                {t.name}
              </li>
            ))}
          </ul>
        )}
        {lecture.description && (
          <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
        )}
      </header>

      {documents.length > 0 && (
        <section className="flex flex-col gap-4">
          {documents.map((doc, i) => (
            <div key={doc.id ?? i} className="flex flex-col gap-2">
              {doc.filename && (
                <h2 className="text-xl font-semibold">{doc.filename}</h2>
              )}
              <div className="prose prose-sm max-w-none">
                <AstRender blocks={doc.blocks ?? []} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-label="Комментарии">
        <h2 className="text-xl font-semibold">Комментарии</h2>
        <CommentTreeView subtrees={comments} />
      </section>
    </article>
  );
}
