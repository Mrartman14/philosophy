// src/features/reference-graph/ui/three-graph-renderer.ts
import * as THREE from "three";

import { ThreeSceneRenderer } from "@/components/scene-3d";

import type { GraphRenderModel } from "../types";

/**
 * Граф-рендерер: общий каркас из ThreeSceneRenderer + слой рёбер (LineSegments, weight→прозрачность
 * через vertex-alpha). Цвета узлов уже precomputed в model.colors (по type) — база рисует облако,
 * этот класс только дорисовывает рёбра.
 */
export class ThreeGraphRenderer extends ThreeSceneRenderer {
  private edges: THREE.LineSegments | null = null;
  private edgeModel: GraphRenderModel | null = null;

  override setModel(model: GraphRenderModel): void {
    this.edgeModel = model; // запомнить для onModelApplied (база зовёт его в конце super.setModel)
    super.setModel(model); // строит облако точек + вызывает onModelApplied → rebuild рёбер
  }

  /** База позвала после применения модели → (пере)собрать слой рёбер. */
  protected override onModelApplied(): void {
    this.disposeEdges();
    const m = this.edgeModel;
    if (!m || m.edges.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(m.edges, 3));
    // Альфа на ВЕРШИНУ (1 значение/вершина, count_edges*2) → один LineSegments-меш с per-vertex
    // прозрачностью. Имя атрибута — aAlpha (varying — vAlpha).
    const aAlpha = new Float32Array(m.edgeAlphas); // count_edges*2
    geom.setAttribute("aAlpha", new THREE.BufferAttribute(aAlpha, 1));
    const mat = new THREE.LineBasicMaterial({
      color: 0x8899aa,
      transparent: true,
      opacity: 0.5, // базовая полупрозрачность; per-vertex alpha варьирует weight'ом через shader-hook ниже
      depthWrite: false,
    });
    // weight→прозрачность: подмешиваем vertex-alpha в фрагментный цвет линии.
    // ВАЖНО: токен `vec4( outgoingLight, diffuseColor.a )` НЕ инлайнится в LineBasicMaterial
    // (он внутри chunk `#include <opaque_fragment>`), поэтому .replace по нему молча no-op'ит и
    // per-edge alpha теряется. Версия-устойчивый приём — допереумножить alpha ПОСЛЕ chunk'а.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float aAlpha;\nvarying float vAlpha;\n" +
        shader.vertexShader.replace("void main() {", "void main() {\n  vAlpha = aAlpha;");
      shader.fragmentShader = shader.fragmentShader
        .replace("varying", "varying float vAlpha;\nvarying")
        .replace(
          "#include <opaque_fragment>",
          "#include <opaque_fragment>\n  gl_FragColor.a *= vAlpha;",
        );
    };
    this.edges = new THREE.LineSegments(geom, mat);
    this.scene.add(this.edges);
    this.requestRender();
  }

  protected override disposeLayers(): void {
    this.disposeEdges();
  }

  private disposeEdges(): void {
    if (this.edges) {
      this.scene.remove(this.edges);
      this.edges.geometry.dispose();
      const m = this.edges.material;
      if (Array.isArray(m)) m.forEach((x) => { x.dispose(); });
      else m.dispose();
    }
    this.edges = null;
  }
}
