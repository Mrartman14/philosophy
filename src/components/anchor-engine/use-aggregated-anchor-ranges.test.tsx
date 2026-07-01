import { render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnchorGeometry } from "./types";
import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";
import type { RailScopeEntry } from "./use-rail-scopes";

afterEach(() => {
  document.body.innerHTML = "";
});

// Программно строим <div data-anchor-scope><p data-block-id="b1">…</p></div> и
// держим ссылку на текстовый узел напрямую — без innerHTML/querySelector
// (testing-library/no-node-access — error в anchor-engine-тестах).
function scopeEl(text: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  const p = document.createElement("p");
  p.dataset.blockId = "b1";
  p.dataset.nodeId = "b1"; // одиночный лист: node_id == block_id (resolveAnchor tryExact)
  p.appendChild(document.createTextNode(text));
  el.appendChild(p);
  document.body.appendChild(el);
  return el;
}

// Скоуп-таблица для rect-якорей: <table data-block-id="t1"> с двумя td
// data-node-id="c1"/"c2". getBoundingClientRect на ячейках застаблен (jsdom не
// делает layout) — bbox прямоугольника считается по этим rect'ам в table-grid.
function tableScopeEl(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:t");
  const table = document.createElement("table");
  table.dataset.blockId = "t1";
  const tbody = document.createElement("tbody");
  const tr = document.createElement("tr");
  const c1 = document.createElement("td");
  c1.dataset.nodeId = "c1";
  c1.appendChild(document.createTextNode("aa"));
  const c2 = document.createElement("td");
  c2.dataset.nodeId = "c2";
  c2.appendChild(document.createTextNode("bb"));
  c1.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  c2.getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
  tr.append(c1, c2);
  tbody.append(tr);
  table.append(tbody);
  el.append(table);
  document.body.appendChild(el);
  return el;
}

const noopRender = (): null => null;

function Probe({
  scopes,
  onRanges,
}: {
  scopes: RailScopeEntry[];
  onRanges: (ids: string[]) => void;
}) {
  const { ranges } = useAggregatedAnchorRanges(scopes);
  useEffect(() => {
    onRanges([...ranges.keys()].filter((k) => ranges.get(k) !== null));
  });
  return null;
}

// Богатый probe: отдаёт СЫРЫЕ карты geometries+ranges целиком — для rect-пути
// (geometries.get(id).kind === "rect", ranges.get(id) === null) и для проверки
// точного range по конкретной ноте (startOffset листа-относительного резолва).
function GeomProbe({
  scopes,
  onGeom,
}: {
  scopes: RailScopeEntry[];
  onGeom: (geometries: Map<string, AnchorGeometry | null>, ranges: Map<string, Range | null>) => void;
}) {
  const { geometries, ranges } = useAggregatedAnchorRanges(scopes);
  useEffect(() => {
    onGeom(geometries, ranges);
  });
  return null;
}

describe("useAggregatedAnchorRanges", () => {
  it("resolves each scope's note within its OWN root, not a sibling's", () => {
    // Тот же block-id "b1" в ДВУХ скоупах, но РАЗНЫЙ текст: каждая заметка должна
    // резолвиться строго в корне своего скоупа. exact каждой заметки существует
    // ТОЛЬКО в её корне — если бы n-b резолвился против корня A («alpha beta»),
    // строки «delta» там нет → Range = null → тест бы упал. Так single-root баг
    // (оба резолвятся в одном корне) не прошёл бы мимо non-null проверки.
    const a = scopeEl("alpha beta"); // exact «alpha» (0..5) живёт только тут
    const b = scopeEl("gamma delta"); // exact «delta» (6..11) живёт только тут
    const scopes: RailScopeEntry[] = [
      {
        key: "annotation:document:a",
        rootEl: a,
        tone: "annotation",
        notes: [
          {
            id: "n-a",
            anchor: {
              startBlockId: "b1",
              startNodeId: "b1",
              endBlockId: "b1",
              endNodeId: "b1",
              startChar: 0,
              endChar: 5,
              exact: "alpha",
            },
          },
        ],
        renderNote: noopRender,
      },
      {
        key: "annotation:document:b",
        rootEl: b,
        tone: "annotation",
        notes: [
          {
            id: "n-b",
            anchor: {
              startBlockId: "b1",
              startNodeId: "b1",
              endBlockId: "b1",
              endNodeId: "b1",
              startChar: 6,
              endChar: 11,
              exact: "delta",
            },
          },
        ],
        renderNote: noopRender,
      },
    ];
    let resolved: string[] = [];
    render(<Probe scopes={scopes} onRanges={(r) => (resolved = r)} />);
    expect(resolved.sort()).toEqual(["n-a", "n-b"]);
  });

  // F6 #1 — ЖИВОЙ rect-путь на уровне page-level агрегатора. Единственный прежний
  // rect-тест жил на МЁРТВОМ useAnchorRanges (движок его удаляет); rect-якоря
  // (table-cell) ходят в прод именно через useAggregatedAnchorRanges. startNodeId
  // != endNodeId, обе ячейки ОДНОЙ таблицы → resolveAnchor даёт kind:"rect" (bbox),
  // а НЕ линейный Range. Производный range-слой для Highlight API/overlay при этом
  // null (прямоугольники в Highlight API не идут — подсвечиваются оверлеем bbox).
  it("rect-якорь (две ячейки одной таблицы) → geometries kind:rect, ranges null", () => {
    const t = tableScopeEl();
    const scopes: RailScopeEntry[] = [
      {
        key: "annotation:document:t",
        rootEl: t,
        tone: "annotation",
        notes: [
          {
            id: "rn",
            anchor: {
              startBlockId: "t1",
              startNodeId: "c1",
              endBlockId: "t1",
              endNodeId: "c2",
              startChar: 0,
              endChar: 2,
              exact: "aabb",
            },
          },
        ],
        renderNote: noopRender,
      },
    ];
    let geom = new Map<string, AnchorGeometry | null>();
    let rng = new Map<string, Range | null>();
    render(
      <GeomProbe
        scopes={scopes}
        onGeom={(g, r) => {
          geom = g;
          rng = r;
        }}
      />,
    );
    const g = geom.get("rn");
    expect(g?.kind).toBe("rect");
    // bbox объединяет обе ячейки (0..20 по X) → clientRects несёт один прямоугольник.
    expect(g?.clientRects.length).toBe(1);
    // range-слой (Highlight API / overlay) для rect-якоря — null.
    expect(rng.get("rn")).toBeNull();
  });

  // F6 #20 — rail-уровень ДИСКРИМИНИРУЕТ node_id fast-path (tryExact: лист-
  // относительные офсеты), а не маскирует его searchQuote-фолбэком по exact. Лист
  // node_id="leaf1" != block_id="blk1"; в листе ДУБЛЬ "cat cat", целимся во ВТОРОЙ
  // "cat" ЛИСТ-относительным офсетом startChar 4. tryExact резолвит по офсету внутри
  // листа → берёт второй "cat" (startOffset 4). Если бы fast-path сломали и резолв
  // ушёл в searchQuote по exact "cat" (full.indexOf → 0), вернулся бы ПЕРВЫЙ "cat"
  // (startOffset 0) — ассерт startOffset===4 это ловит. Без дубля exact был бы
  // уникален и фолбэк совпал бы с fast-path, маскируя поломку офсетного резолва.
  it("node_id fast-path: лист-относительный офсет берёт ВТОРОЙ дубль, не exact-фолбэк", () => {
    const el = document.createElement("div");
    el.setAttribute("data-anchor-scope", "document:d");
    const block = document.createElement("div");
    block.dataset.blockId = "blk1";
    const leaf = document.createElement("span");
    leaf.dataset.nodeId = "leaf1"; // node_id != block_id
    leaf.appendChild(document.createTextNode("cat cat"));
    block.appendChild(leaf);
    el.appendChild(block);
    document.body.appendChild(el);
    const scopes: RailScopeEntry[] = [
      {
        key: "annotation:document:d",
        rootEl: el,
        tone: "annotation",
        notes: [
          {
            id: "dn",
            anchor: {
              startBlockId: "blk1",
              startNodeId: "leaf1",
              endBlockId: "blk1",
              endNodeId: "leaf1",
              startChar: 4, // лист-относительный офсет ВТОРОГО "cat"
              endChar: 7,
              exact: "cat",
            },
          },
        ],
        renderNote: noopRender,
      },
    ];
    let rng = new Map<string, Range | null>();
    render(<GeomProbe scopes={scopes} onGeom={(_g, r) => (rng = r)} />);
    const range = rng.get("dn");
    expect(range).not.toBeNull();
    expect(range?.toString()).toBe("cat");
    // startOffset 4 (второй "cat") доказывает офсетный fast-path; 0 был бы exact-фолбэком.
    expect(range?.startOffset).toBe(4);
  });
});
