import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const version = Date.now().toString(36);

// Generate sw.js
const swTemplate = readFileSync(resolve(root, 'src/sw.template.js'), 'utf-8');
const sw = swTemplate
  .replaceAll('__BASE_PATH__', basePath)
  .replaceAll('__SW_VERSION__', version);
writeFileSync(resolve(root, 'public/sw.js'), sw);

// Generate manifest.webmanifest
const manifestTemplate = readFileSync(resolve(root, 'src/manifest.template.json'), 'utf-8');
const manifest = manifestTemplate.replaceAll('__BASE_PATH__', basePath);
writeFileSync(resolve(root, 'public/manifest.webmanifest'), manifest);

console.log(`[generate-sw-assets] basePath="${basePath}" version="${version}"`);
