/**
 * URL для image src, где `storage_key` — SHA256-hex content-address файла.
 * Используется image NodeView и любыми future-консьюмерами AST image-блока.
 *
 * MVP — env-driven с фолбэком на API host. Spec §6.5 / §9 допускают
 * переход на schema-driven (поле в /api/ast/schema) без breaking change
 * для NodeView — точка изменения локализована здесь.
 */
export function resolveStorageUrl(storageKey: string): string {
  if (!storageKey) return "";
  const base =
    process.env.NEXT_PUBLIC_STORAGE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "";
  return `${base}/static/files/${storageKey}`;
}
