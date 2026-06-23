// src/components/ui/navigation-menu.tsx

/**
 * Compound-обёртка над Base UI NavigationMenu. Единственный потребитель
 * (app-header) несёт полностью bespoke-разметку, поэтому обёртка не навязывает
 * дефолтных классов — только маршрутизирует импорт через kit (ноль прямых
 * @base-ui/react вне UI-kit).
 */
export { NavigationMenu } from "@base-ui/react/navigation-menu";
