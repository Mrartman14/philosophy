// src/features/semantic-map/renderer/three-map-renderer.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { RenderModel } from "../types";

import { fit2D, fit3D } from "./camera-fit";
import type { MapOverlayState, MapRenderer, RenderMode } from "./map-renderer";

export class ThreeMapRenderer implements MapRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly ortho: THREE.OrthographicCamera;
  private readonly persp: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private points: THREE.Points | null = null;
  private model: RenderModel | null = null;
  private mode: RenderMode = "2d";
  private width = 1;
  private height = 1;
  private dpr = 1;
  /** Полу-высота ортокадра (мировые ед.) — для aspect-only ресайза без перекадрирования. */
  private orthoHalfH = 1;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private changeCb: (() => void) | null = null;
  private baseColors: Float32Array | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;
  private marker: THREE.Sprite | null = null;

  constructor() {
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    this.persp = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  }

  mount(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.applyMode();
    // Первый кадр сразу в правильном буфере (иначе мелькнёт 1×1, растянутый CSS).
    this.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    this.dirty = true;
    this.loop();
  }

  setModel(model: RenderModel): void {
    this.model = model;
    if (this.points) {
      this.scene.remove(this.points);
      disposePoints(this.points);
      this.points = null;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(model.positions, 3));
    const colorAttr = new THREE.BufferAttribute(model.colors, 3);
    geom.setAttribute("color", colorAttr);
    this.colorAttr = colorAttr;
    this.baseColors = model.colors.slice(); // копия для восстановления при снятии overlay
    const mat = new THREE.PointsMaterial({
      // Размер в ПИКСЕЛЯХ (sizeAttenuation:false) в ОБОИХ режимах — предсказуемо и не зависит
      // от масштаба bounds. (В 3D с world-unit-размером на нормализованных ~[-1,1] координатах
      // точки вырождались бы в субпиксельные пятна.) depthWrite:false — убрать blending-артефакты.
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.points = new THREE.Points(geom, mat);
    this.scene.add(this.points);
    this.fitToBounds();
  }

  setMode(mode: RenderMode): void {
    if (mode === this.mode && this.controls) return;
    this.mode = mode;
    this.applyMode();
  }

  private applyMode(): void {
    if (this.controls) this.controls.dispose();
    const cam = this.activeCamera();
    if (this.renderer) {
      this.controls = new OrbitControls(cam, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.enableRotate = this.mode === "3d";
      if (this.mode === "2d") {
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
      }
      this.controls.addEventListener("change", () => {
        this.dirty = true;
      });
    }
    // Материал mode-агностичен (пиксельный размер) — пере-настраивать при смене режима не нужно.
    this.fitToBounds();
  }

  private activeCamera(): THREE.Camera {
    return this.mode === "3d" ? this.persp : this.ortho;
  }

  fitToBounds(): void {
    if (!this.model) return;
    const { min, max } = this.model.bounds;
    const aspect = this.width / this.height || 1;
    if (this.mode === "2d") {
      const f = fit2D(min, max, aspect);
      this.orthoHalfH = f.halfH;
      this.ortho.left = -f.halfH * aspect;
      this.ortho.right = f.halfH * aspect;
      this.ortho.top = f.halfH;
      this.ortho.bottom = -f.halfH;
      this.ortho.zoom = 1; // сбросить накопленный пользователем zoom при пере-фите
      this.ortho.position.set(f.centerX, f.centerY, 10);
      this.ortho.up.set(0, 1, 0);
      this.ortho.lookAt(f.centerX, f.centerY, 0);
      this.ortho.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(f.centerX, f.centerY, 0);
        this.controls.update();
      }
    } else {
      const f = fit3D(min, max, this.persp.fov, 1.3);
      this.persp.position.set(
        f.center[0] + f.distance * 0.6,
        f.center[1] + f.distance * 0.4,
        f.center[2] + f.distance * 0.8,
      );
      this.persp.lookAt(f.center[0], f.center[1], f.center[2]);
      this.persp.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(f.center[0], f.center[1], f.center[2]);
        this.controls.update();
      }
    }
    this.dirty = true;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(dpr, 2);
    if (this.renderer) {
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height, false);
    }
    const aspect = this.width / this.height;
    // Ресайз меняет ТОЛЬКО aspect, НЕ перекадрирует (иначе сбивал бы pan/zoom/орбиту).
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    this.ortho.left = -this.orthoHalfH * aspect;
    this.ortho.right = this.orthoHalfH * aspect;
    this.ortho.top = this.orthoHalfH;
    this.ortho.bottom = -this.orthoHalfH;
    this.ortho.updateProjectionMatrix();
    this.dirty = true;
  }

  getViewProjection(): Float32Array | null {
    if (!this.renderer) return null;
    const cam = this.activeCamera() as THREE.OrthographicCamera | THREE.PerspectiveCamera;
    cam.updateMatrixWorld();
    // Считаем inverse САМИ: matrixWorldInverse обновляет только renderer.render(), а нас
    // зовут и вне render-тика (post-mount/resize) — иначе подписи легли бы по устаревшей матрице.
    const viewInverse = cam.matrixWorld.clone().invert();
    const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, viewInverse);
    return new Float32Array(m.elements);
  }

  onChange(cb: () => void): void {
    this.changeCb = cb;
  }

  onPick(_cb: (id: string | null) => void): void {
    // Стаб v1: hover/click-picking — будущая фаза (overlay/lazy-детали). cb игнорируется.
  }

  setOverlay(overlay: MapOverlayState | null): void {
    if (!this.model || !this.colorAttr || !this.baseColors) return;
    const ids = this.model.ids;
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
    this.dirty = true;
  }

  private updateMarker(pos: [number, number, number] | null): void {
    if (!pos) {
      if (this.marker) this.marker.visible = false;
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
  }

  private readonly loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.controls?.enableDamping) this.controls.update();
    if (!this.dirty || !this.renderer) return;
    this.renderer.render(this.scene, this.activeCamera());
    this.dirty = false;
    this.changeCb?.();
  };

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    if (this.points) disposePoints(this.points);
    if (this.marker) {
      this.marker.material.map?.dispose();
      this.marker.material.dispose();
    }
    this.renderer?.dispose();
    this.renderer = null;
  }
}

function disposePoints(p: THREE.Points): void {
  p.geometry.dispose();
  const m = p.material;
  if (Array.isArray(m)) m.forEach((x) => { x.dispose(); });
  else m.dispose();
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
