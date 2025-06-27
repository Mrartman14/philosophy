export function getColorFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += value.toString(16).padStart(2, "0");
  }
  return color;
}

function hashToInt(value: string, maxValue: number) {
  // Простая хеш-функция для строки
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Преобразование в 32-битное целое
  }
  return Math.abs(hash) % maxValue;
}

export function getColorFromStringWithPrefix(s: string, prefixLength = 3) {
  const prefix = s.substring(0, prefixLength);
  const suffix = s.substring(prefixLength);

  const hue = hashToInt(prefix, 360);
  const saturation = 40 + hashToInt(suffix, 40); // 40–80%
  const lightness = 40 + hashToInt(suffix.split("").reverse().join(""), 30); // 40–70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
