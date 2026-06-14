// Ambient declarations for non-code side-effect imports.
//
// TypeScript 6.0 tightened checking of side-effect imports (TS2882): a bare
// `import "./globals.css"` now needs a module declaration. Next.js resolves
// CSS via its bundler at build time, so this only declares the shape for tsc.
declare module "*.css";
