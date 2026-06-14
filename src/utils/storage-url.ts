/**
 * URL файла по content-address `storage_key` (SHA256-hex). База —
 * `NEXT_PUBLIC_STORAGE_URL`, фолбэк — `NEXT_PUBLIC_API_URL`. Пустая env-строка
 * трактуется как «не задано» (→ фолбэк, поэтому `||`, а не `??`). Пустой ключ
 * → `""`.
 *
 * Единая точка для AST image-блоков (ast-editor / ast-render) и обложек лекций.
 * Spec §6.5 / §9 допускают переход на schema-driven без breaking change —
 * точка изменения локализована здесь.
 */
export function resolveStorageUrl(storageKey: string): string {
  if (!storageKey) return "";
  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- пустая env-строка трактуется как «не задано» (→ фолбэк), ?? оставил бы "" как базу URL */
  const base =
    process.env.NEXT_PUBLIC_STORAGE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
  return `${base}/static/files/${storageKey}`;
}
