// src/features/semantic-map/renderer/three-map-renderer.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { RenderModel } from "../types";

import { fit2D, fit3D } from "./camera-fit";
import type { MapOverlayState, MapRenderer, RenderMode } from "./map-renderer";
import { pickNearestPoint } from "./pick";

const PICK_THRESHOLD_PX = 10; // радиус попадания по точке
const DRAG_SUPPRESS_PX = 5; // смещение, выше которого жест — драг, не клик

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
  private reducedMotion = false;
  private canvas: HTMLCanvasElement | null = null;
  private pickCb: ((id: string | null) => void) | null = null;
  /** Позиция pointerdown (canvas-local) — чтобы отличить клик от драга. */
  private downAt: { x: number; y: number } | null = null;

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
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
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
    const working = model.colors.slice(); // рабочий буфер атрибута (мутируется overlay'ем)
    const colorAttr = new THREE.BufferAttribute(working, 3);
    geom.setAttribute("color", colorAttr);
    this.colorAttr = colorAttr;
    this.baseColors = model.colors; // вход трактуем как неизменяемую базу (только чтение в setOverlay)
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
    this.updateMarker(null); // спрятать устаревший маркер при смене модели; overlay реаплаит call-site
    this.fitToBounds();
  }

  setMode(mode: RenderMode): void {
    if (mode === this.mode && this.controls) return;
    this.mode = mode;
    this.applyMode();
  }

  setReducedMotion(reduce: boolean): void {
    this.reducedMotion = reduce;
    if (this.controls) {
      this.controls.enableDamping = !reduce;
      this.dirty = true;
    }
  }

  private applyMode(): void {
    if (this.controls) this.controls.dispose();
    const cam = this.activeCamera();
    if (this.renderer) {
      this.controls = new OrbitControls(cam, this.renderer.domElement);
      this.controls.enableDamping = !this.reducedMotion;
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

  onPick(cb: (id: string | null) => void): void {
    this.pickCb = cb;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.downAt = this.toLocal(e);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const down = this.downAt;
    this.downAt = null;
    if (!down || !this.pickCb) return;
    const up = this.toLocal(e);
    // Драг (пан/орбита) — не клик: гасим, чтобы навигация не открывала панель.
    if (Math.hypot(up.x - down.x, up.y - down.y) > DRAG_SUPPRESS_PX) return;
    if (!this.model || this.model.count === 0) {
      this.pickCb(null);
      return;
    }
    const vp = this.getViewProjection();
    if (!vp) {
      this.pickCb(null);
      return;
    }
    const idx = pickNearestPoint(
      this.model.positions,
      this.model.count,
      vp,
      this.width,
      this.height,
      up.x,
      up.y,
      PICK_THRESHOLD_PX,
    );
    this.pickCb(idx >= 0 ? this.model.ids[idx] ?? null : null);
  };

  /** clientX/Y → canvas-local пиксели (CSS-пиксели, как width/height рендерера). */
  private toLocal(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect();
    return rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : { x: e.clientX, y: e.clientY };
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
      this.dirty = true;
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
    this.dirty = true;
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
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
    }
    this.canvas = null;
    this.pickCb = null;
    this.downAt = null;
    this.controls?.dispose();
    if (this.points) disposePoints(this.points);
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker.material.map?.dispose();
      this.marker.material.dispose();
    }
    this.marker = null;
    this.points = null;
    this.colorAttr = null;
    this.baseColors = null;
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
