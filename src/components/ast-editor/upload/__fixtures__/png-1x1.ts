/**
 * Минимальный валидный PNG (1×1 прозрачный пиксель). Используется в тестах
 * upload — http.DetectContentType на бэке полагается на magic bytes; этот
 * блок гарантированно сниффится как `image/png`.
 */
const BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function decode(): Uint8Array {
  const bin = atob(BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function makePngFile(name = "test.png"): File {
  return new File([decode()], name, { type: "image/png" });
}

export function makePngBlob(): Blob {
  return new Blob([decode()], { type: "image/png" });
}
