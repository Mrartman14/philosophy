// src/components/ui/direction-provider.tsx
// Тонкая ui-kit обёртка над Base UI DirectionProvider: чистый context-провайдер
// без DOM/стилей, поэтому достаточно ре-экспорта. Импорт из @base-ui разрешён
// здесь, т.к. файл живёт под src/components/ui/** (Guardrail 7).
// "use client" не нужен: это чистый ре-экспорт, а модуль base-ui уже несёт директиву.
export { DirectionProvider } from "@base-ui/react/direction-provider";
