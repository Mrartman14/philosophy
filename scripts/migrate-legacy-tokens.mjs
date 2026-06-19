import { readFileSync, writeFileSync } from "node:fs";
// Порядок важен: -fill-hover до -fill.
// --color-surface НЕ в карте: это новое каноническое имя базовой поверхности
// (эмитится @theme inline), а не legacy — существующие ссылки на него уже валидны.
const MAP = [
  ["--color-danger-fill-hover", "--color-danger"],
  ["--color-danger-fill", "--color-danger"],
  ["--color-background", "--color-surface"],
  ["--color-foreground", "--color-fg"],
  ["--color-text-pane", "--color-surface-subtle"],
  ["--color-description", "--color-fg-muted"],
  ["--color-primary", "--color-accent"],
];
const files = process.argv.slice(2);
let changed = 0;
for (const f of files) {
  const src = readFileSync(f, "utf-8");
  let out = src;
  for (const [from, to] of MAP) out = out.split(from).join(to);
  if (out !== src) { writeFileSync(f, out); changed++; }
}
console.log(`[migrate-legacy-tokens] changed ${changed}/${files.length} files`);
