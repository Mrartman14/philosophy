"use client";
// src/components/ui/direction-provider.tsx
// Тонкая ui-kit обёртка над Base UI DirectionProvider: чистый context-провайдер
// без DOM/стилей, поэтому достаточно ре-экспорта. Импорт из @base-ui разрешён
// здесь, т.к. файл живёт под src/components/ui/** (Guardrail 7).
export { DirectionProvider } from "@base-ui/react/direction-provider";
