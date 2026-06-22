// src/features/semantic-map/renderer/three-map-renderer.ts
import * as THREE from "three";

import { ThreeSceneRenderer } from "@/components/scene-3d";

import type { RenderModel } from "../types";

import type { MapOverlayState, MapRenderer } from "./map-renderer";

/** Карто-рендерер: общий каркас из ThreeSceneRenderer + дельта (overlay поиска + ring-marker). */
export class ThreeMapRenderer extends ThreeSceneRenderer implements MapRenderer {
  private marker: THREE.Sprite | null = null;

  // Сужаем публичный тип обратно до RenderModel: карта без docs/clusters невалидна
  // (matchOverlay/подписи их читают). База типизирует setModel шире (SceneRenderModel).
  override setModel(model: RenderModel): void {
    super.setModel(model);
  }

  setOverlay(overlay: MapOverlayState | null): void {
    const model = this.model as RenderModel | null;
    if (!model || !this.colorAttr || !this.baseColors) return;
    const ids = model.ids;
    const arr = this.colorAttr.array as Float32Array;
    const DIM = 0.18;
    if (!overlay || overlay.highlightIds.size === 0) {
      arr.set(this.baseColors); // восстановить полные цвета
    } else {
      for (let i = 0; i < ids.length; i++) {
        const hit = overlay.highlightIds.has(ids[i] ?? "");
        const k = hit ? 1 : DIM;
        arr[i * 3] = (this.baseColors[i * 3] ?? 0) * k;
        arr[i * 3 + 1] = (this.baseColors[i * 3 + 1] ?? 0) * k;
        arr[i * 3 + 2] = (this.baseColors[i * 3 + 2] ?? 0) * k;
      }
    }
    this.colorAttr.needsUpdate = true;
    this.updateMarker(overlay?.marker ?? null);
    this.requestRender();
  }

  /** Смена модели прячет устаревший marker; overlay реаплаит call-site (как раньше). */
  protected override onModelApplied(): void {
    this.updateMarker(null);
  }

  protected override disposeLayers(): void {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker.material.map?.dispose();
      this.marker.material.dispose();
    }
    this.marker = null;
  }

  private updateMarker(pos: [number, number, number] | null): void {
    if (!pos) {
      if (this.marker) this.marker.visible = false;
      this.requestRender();
      return;
    }
    if (!this.marker) {
      const mat = new THREE.SpriteMaterial({ map: makeRingTexture(), transparent: true, depthTest: false });
      this.marker = new THREE.Sprite(mat);
      this.scene.add(this.marker);
    }
    const { min, max } = this.model?.bounds ?? { min: [-1, -1, -1], max: [1, 1, 1] };
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
    const s = diag * 0.06;
    this.marker.scale.set(s, s, 1);
    this.marker.position.set(pos[0], pos[1], pos[2]);
    this.marker.visible = true;
    this.requestRender();
  }
}

function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
