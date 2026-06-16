import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Инлайним чистую SW-логику из единого TS-источника (покрыт юнит-тестами).
// Транспилируем в JS и срезаем import/export — в SW нет модульной системы.
const logicTs = readFileSync(
  resolve(root, 'src/services/offline/sw/sw-logic.ts'),
  'utf-8',
);
const logicJs = ts
  .transpileModule(logicTs, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
    },
  })
  .outputText;
const inlinedLogic = logicJs
  .replace(/^\s*import[^\n]*\r?\n/gm, '')
  .replace(/^export /gm, '');

// Generate sw.js (replace-функцией, чтобы $-последовательности в коде не интерпретировались)
const swTemplate = readFileSync(resolve(root, 'src/sw.template.js'), 'utf-8');

// Версия — sha256 от исходного содержимого (template + inlined logic) ДО подстановки версии,
// чтобы хэш не был самореферентным. Одинаковый источник → одинаковый хэш на любой машине.
const version = createHash('sha256')
  .update(swTemplate)
  .update(inlinedLogic)
  .digest('hex')
  .slice(0, 10);

const sw = swTemplate
  .replace('//__SW_LOGIC__', () => inlinedLogic)
  .replaceAll('__BASE_PATH__', '')
  .replaceAll('__SW_VERSION__', version);
writeFileSync(resolve(root, 'public/sw.js'), sw);

// Generate manifest.webmanifest
const manifestTemplate = readFileSync(resolve(root, 'src/manifest.template.json'), 'utf-8');
writeFileSync(resolve(root, 'public/manifest.webmanifest'), manifestTemplate);

console.log(`[generate-sw-assets] version="${version}"`);
