"use client";

import { useActionState, useState, useTransition } from "react";
import type { LectureFile } from "@/api/types";
import { deleteFile, uploadFile } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

interface FileManagerProps {
  lectureId: string;
  files: LectureFile[];
}

const initialState: ActionResult<void> = { success: true, data: undefined };

export const FileManager: React.FC<FileManagerProps> = ({
  lectureId,
  files,
}) => {
  const [state, action, pending] = useActionState(uploadFile, initialState);

  return (
    <div className="border border-(--color-border) rounded-lg p-4 flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="lectureId" value={lectureId} />
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="type"
            required
            defaultValue="video"
            className="px-3 py-2 border border-(--color-border) rounded bg-transparent text-sm"
          >
            <option value="video">Видео</option>
            <option value="notes">Конспект</option>
            <option value="image">Изображение</option>
          </select>
          <input
            type="file"
            name="file"
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
          >
            {pending ? "Загрузка…" : "Загрузить"}
          </button>
        </div>
        {state.success === false && (
          <p className="text-xs text-red-500" role="alert">
            {state.code === "forbidden"
              ? "У вас нет прав на загрузку/удаление файлов."
              : state.error}
          </p>
        )}
      </form>

      {files.length === 0 ? (
        <p className="text-sm text-(--color-description)">Файлов нет.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 text-xs border border-(--color-border) rounded uppercase">
                  {file.type}
                </span>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-(--color-link) hover:underline truncate"
                >
                  {file.filename}
                </a>
              </div>
              <FileDeleteButton lectureId={lectureId} fileId={file.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface FileDeleteButtonProps {
  lectureId: string;
  fileId: string;
}

const FileDeleteButton: React.FC<FileDeleteButtonProps> = ({
  lectureId,
  fileId,
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!confirm("Удалить файл?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFile({ lectureId, fileId });
      if (!result.success) {
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на загрузку/удаление файлов."
            : result.error
        );
      }
    });
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-2 py-1 text-xs border border-red-500 text-red-500 rounded disabled:opacity-50"
      >
        {pending ? "…" : "Удалить"}
      </button>
      {error && (
        <span className="text-xs text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
