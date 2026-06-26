"use client";
// src/features/canvas/ui/canvas-export.tsx
// ВРЕМЕННЫЙ ШИМ: реальная реализация переехала в engine/svg/svg-export.
// Удаляется в финальной задаче после перевода canvas-editor на painter.
export { buildExportSvg, downloadCanvasSvg, downloadCanvasPng } from "../engine/svg/svg-export";
export type { ExportSvg } from "../engine/svg/svg-export";
