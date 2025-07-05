export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 байт";
  const units = ["байт", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${size} ${units[i]}`;
}

export function getFilenameFromContentDisposition(
  contentDisposition: string | null
) {
  if (contentDisposition && contentDisposition.includes("filename=")) {
    const filename = contentDisposition
      .split("filename=")[1]
      .replace(/['"]/g, "")
      .trim();

    return filename;
  }

  return null;
}
