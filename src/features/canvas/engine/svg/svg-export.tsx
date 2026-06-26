"use client";
// src/features/canvas/engine/svg/svg-export.tsx
import { renderToStaticMarkup } from "react-dom/server";

import { ArrowMarkerDefs, boundingBox, EdgeShapeRender, NodeShapeRender } from "@/components/canvas-render";
import type { EntityRefResolver, RenderData, RenderNode } from "@/components/canvas-render";

import type { CanvasData } from "../../types";

const MARGIN = 24;

/**
 * Чистый экспортный SVG графа: ТОТ ЖЕ NodeShapeRender, что в read-only рендере
 * (без дублирования отрисовки узлов), + фон и прямые рёбра. Никаких служебных
 * слоёв редактора (выделение/ручки/marquee). viewBox по bounding box графа.
 * Цвета остаются токенами var(--color-*) — их вшивает inlineThemeColors поверх
 * сериализованной строки (иначе в отдельном файле/растре они не разрешатся).
 */
function CanvasExportSvg({ data, resolveEntityRef }: { data: RenderData; resolveEntityRef: EntityRefResolver }) {
  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - MARGIN;
  const vbY = bbox.minY - MARGIN;
  const vbW = bbox.maxX - bbox.minX + MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + MARGIN * 2;
  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} width={vbW} height={vbH}>
      <ArrowMarkerDefs />
      {/* Фон — чтобы текст (--color-fg) был читаем и в SVG, и в PNG (иначе прозрачный). */}
      <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="var(--color-surface)" />
      {data.edges.map((e) => (
        <EdgeShapeRender key={e.id} edge={e} nodesById={byId} />
      ))}
      {data.nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </svg>
  );
}

const COLOR_VAR_RE = /var\((--color-[a-z0-9-]+)\)/g;

/** Заменяет var(--color-*) на вычисленные значения темы из cascade rootEl. */
function inlineThemeColors(svg: string, rootEl: Element): string {
  const cs = getComputedStyle(rootEl);
  const cache = new Map<string, string>();
  return svg.replace(COLOR_VAR_RE, (_m, token: string) => {
    let v = cache.get(token);
    if (v === undefined) {
      v = cs.getPropertyValue(token).trim() || "#000";
      cache.set(token, v);
    }
    return v;
  });
}

export interface ExportSvg {
  svg: string;
  width: number;
  height: number;
}

/** Строит самодостаточный SVG графа (цвета темы вшиты) + его пиксельные размеры. */
export function buildExportSvg(data: RenderData, resolveEntityRef: EntityRefResolver, rootEl: Element): ExportSvg {
  const bbox = boundingBox(data.nodes);
  const width = bbox.maxX - bbox.minX + MARGIN * 2;
  const height = bbox.maxY - bbox.minY + MARGIN * 2;
  const raw = renderToStaticMarkup(<CanvasExportSvg data={data} resolveEntityRef={resolveEntityRef} />);
  return { svg: inlineThemeColors(raw, rootEl), width, height };
}

/** Скачивает Blob под заданным именем (общий клиентский download-хелпер). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Безопасное имя файла из названия канваса (фолбэк «canvas»). */
function safeName(title: string): string {
  const base = title.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, "").replace(/\s+/g, "-");
  return base || "canvas";
}

/** Скачивает граф как .json — исходные данные канваса (schema-форма, как при сейве). */
export function downloadCanvasJson(data: CanvasData, title: string): void {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }),
    `${safeName(title)}.json`,
  );
}

/** Скачивает граф как .svg. */
export function downloadCanvasSvg(data: RenderData, resolveEntityRef: EntityRefResolver, title: string, rootEl: Element): void {
  const { svg } = buildExportSvg(data, resolveEntityRef, rootEl);
  triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${safeName(title)}.svg`);
}

/**
 * Скачивает граф как .png — растеризация того же self-contained SVG на <canvas>
 * (Image → drawImage → toBlob). Без отдельной логики рисования. scale=2 для
 * чёткости. Blob-URL (не data-URL) → canvas не tainted, toBlob работает.
 */
export async function downloadCanvasPng(
  data: RenderData,
  resolveEntityRef: EntityRefResolver,
  title: string,
  rootEl: Element,
  scale = 2,
): Promise<void> {
  const { svg, width, height } = buildExportSvg(data, resolveEntityRef, rootEl);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => { resolve(); };
      img.onerror = () => { reject(new Error("svg image load failed")); };
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    await new Promise<void>((resolve) => {
      canvas.toBlob((png) => {
        if (png) triggerDownload(png, `${safeName(title)}.png`);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
