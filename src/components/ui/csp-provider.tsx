// src/components/ui/csp-provider.tsx
// Тонкая ui-kit обёртка над Base UI CSPProvider: прокидывает nonce на <style>,
// которые Base UI инжектит (Tabs.Indicator, Select.Popup), чтобы они проходили
// style-src-elem 'nonce-…' (см. src/security/csp.ts). Чистый context-провайдер
// без DOM/стилей — достаточно ре-экспорта. Импорт из @base-ui разрешён здесь,
// т.к. файл живёт под src/components/ui/** (Guardrail 7). "use client" не нужен:
// чистый ре-экспорт, а модуль base-ui уже несёт директиву.
export { CSPProvider } from "@base-ui/react/csp-provider";
