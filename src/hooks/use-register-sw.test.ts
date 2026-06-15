import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegisterSW } from "./use-register-sw";

type Cbs = Map<string, Set<() => void>>;
function listen(cbs: Cbs, type: string, cb: () => void): void {
  const set = cbs.get(type) ?? new Set<() => void>();
  cbs.set(type, set);
  set.add(cb);
}

// Минимальные фейки SW-окружения: jsdom не реализует navigator.serviceWorker,
// поэтому подставляем свой контейнер/регистрацию/воркер с ручным emit событий.
class FakeWorker {
  state: string;
  postMessage = vi.fn();
  private cbs: Cbs = new Map();
  constructor(state = "installed") {
    this.state = state;
  }
  addEventListener(type: string, cb: () => void): void {
    listen(this.cbs, type, cb);
  }
  emit(type: string): void {
    this.cbs.get(type)?.forEach((cb) => { cb(); });
  }
}

class FakeRegistration {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  private cbs: Cbs = new Map();
  addEventListener(type: string, cb: () => void): void {
    listen(this.cbs, type, cb);
  }
  emit(type: string): void {
    this.cbs.get(type)?.forEach((cb) => { cb(); });
  }
  hasListener(type: string): boolean {
    return (this.cbs.get(type)?.size ?? 0) > 0;
  }
}

interface FakeContainer {
  controller: unknown;
  register: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  emit: (type: string) => void;
}

function installContainer(opts: {
  controller?: unknown;
  registration: FakeRegistration;
}): FakeContainer {
  const cbs: Cbs = new Map();
  const container: FakeContainer = {
    controller: opts.controller ?? null,
    register: vi.fn().mockResolvedValue(opts.registration),
    addEventListener: (type, cb) => {
      listen(cbs, type, cb);
    },
    removeEventListener: (type, cb) => {
      cbs.get(type)?.delete(cb);
    },
    emit: (type) => {
      cbs.get(type)?.forEach((cb) => { cb(); });
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
  return container;
}

const reloadMock = vi.fn();
// window.location.reload в jsdom non-configurable — подменяем весь location
// (он configurable). Хук читает только location.reload, остального ему не надо.
const originalLocation = window.location;

beforeEach(() => {
  reloadMock.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload: reloadMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
  // Чистим serviceWorker, чтобы тест «нет поддержки» видел голый navigator.
  Reflect.deleteProperty(navigator as object, "serviceWorker");
  vi.clearAllMocks();
});

describe("useRegisterSW", () => {
  it("нет поддержки SW → needsUpdate=false, без ошибок", () => {
    const { result } = renderHook(() => useRegisterSW());
    expect(result.current.needsUpdate).toBe(false);
  });

  it("регистрирует /sw.js с нужными scope/updateViaCache", async () => {
    const c = installContainer({ registration: new FakeRegistration() });
    renderHook(() => useRegisterSW());
    await waitFor(() => {
      expect(c.register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });
  });

  it("уже есть waiting-воркер → needsUpdate=true; applyUpdate шлёт SKIP_WAITING", async () => {
    const reg = new FakeRegistration();
    const waiting = new FakeWorker();
    reg.waiting = waiting;
    installContainer({ registration: reg });

    const { result } = renderHook(() => useRegisterSW());
    await waitFor(() => { expect(result.current.needsUpdate).toBe(true); });

    act(() => { result.current.applyUpdate(); });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("новый воркер установлен ПРИ наличии контроллера → needsUpdate=true (это апдейт)", async () => {
    const reg = new FakeRegistration();
    installContainer({ controller: {}, registration: reg });

    const { result } = renderHook(() => useRegisterSW());
    await waitFor(() => { expect(reg.hasListener("updatefound")).toBe(true); });

    const installing = new FakeWorker("installing");
    reg.installing = installing;
    act(() => { reg.emit("updatefound"); });
    installing.state = "installed";
    act(() => { installing.emit("statechange"); });

    expect(result.current.needsUpdate).toBe(true);
  });

  it("новый воркер установлен БЕЗ контроллера (первая установка) → needsUpdate=false", async () => {
    const reg = new FakeRegistration();
    installContainer({ controller: null, registration: reg });

    const { result } = renderHook(() => useRegisterSW());
    await waitFor(() => { expect(reg.hasListener("updatefound")).toBe(true); });

    const installing = new FakeWorker("installing");
    reg.installing = installing;
    act(() => { reg.emit("updatefound"); });
    installing.state = "installed";
    act(() => { installing.emit("statechange"); });

    expect(result.current.needsUpdate).toBe(false);
  });

  it("controllerchange при наличии контроллера → reload", async () => {
    const c = installContainer({ controller: {}, registration: new FakeRegistration() });
    renderHook(() => useRegisterSW());
    await waitFor(() => { expect(c.register).toHaveBeenCalled(); });

    act(() => { c.emit("controllerchange"); });
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("первый controllerchange без контроллера пропускается, второй → reload", async () => {
    const c = installContainer({ controller: null, registration: new FakeRegistration() });
    renderHook(() => useRegisterSW());
    await waitFor(() => { expect(c.register).toHaveBeenCalled(); });

    act(() => { c.emit("controllerchange"); }); // первая установка (claim) — без reload
    expect(reloadMock).not.toHaveBeenCalled();
    act(() => { c.emit("controllerchange"); }); // последующий апдейт — reload
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("после размонтирования controllerchange не вызывает reload", async () => {
    const c = installContainer({ controller: {}, registration: new FakeRegistration() });
    const { unmount } = renderHook(() => useRegisterSW());
    await waitFor(() => { expect(c.register).toHaveBeenCalled(); });

    unmount();
    act(() => { c.emit("controllerchange"); });
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
