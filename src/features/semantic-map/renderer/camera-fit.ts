// Чистая математика подгонки камеры под bounds (без three).
type Vec3 = [number, number, number];

export interface Frame2D {
  centerX: number;
  centerY: number;
  /** Половина ВЕРТИКАЛЬНОГО мирового размера кадра (уже учитывает aspect, чтобы влезла ширина). */
  halfH: number;
}

// Возвращает только полу-высоту + центр; ширину рендерер выводит как halfH*aspect
// на каждом resize. Это даёт aspect-only ресайз без перекадрирования (см. ThreeMapRenderer.resize),
// и единственное число halfH переживает смену пропорций окна.
export function fit2D(min: Vec3, max: Vec3, aspect: number, pad = 1.1): Frame2D {
  const a = aspect > 0 ? aspect : 1;
  const centerX = (min[0] + max[0]) / 2;
  const centerY = (min[1] + max[1]) / 2;
  const worldW = Math.max(max[0] - min[0], 1e-6);
  const worldH = Math.max(max[1] - min[1], 1e-6);
  // halfH должен покрыть и высоту (worldH/2), и ширину (worldW/2/aspect).
  const halfH = Math.max(worldH / 2, worldW / 2 / a) * pad;
  return { centerX, centerY, halfH };
}

export interface Frame3D {
  center: Vec3;
  distance: number;
}

export function fit3D(min: Vec3, max: Vec3, fovDeg: number, pad = 1.2): Frame3D {
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius =
    0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * pad;
  const r = radius > 0 ? radius : 1;
  const distance = r / Math.sin((fovDeg * Math.PI) / 180 / 2);
  return { center, distance };
}
