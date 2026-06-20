# CSP + Security Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить строгий nonce-CSP (через middleware) + статические security-заголовки, с раскаткой Report-Only → enforce.

**Architecture:** Чистые билдеры политики в `src/security/*` (юнит-тестируемы), интеграция per-request CSP+nonce в существующий middleware `src/proxy.ts`, статические заголовки через `next.config.ts` `headers()`, приём violation-репортов — same-origin route handler, логирующий через observability. Origin'ы внешних ресурсов резолвятся из env; режим (report-only/enforce) — env-флаг.

**Tech Stack:** Next.js 16 App Router, TypeScript, vitest (jsdom), next-intl plugin, observability-фасад `@/services/observability`.

**Design doc:** [docs/superpowers/specs/2026-06-20-csp-security-headers-design.md](../specs/2026-06-20-csp-security-headers-design.md)

## Global Constraints

- **Пакетный менеджер — `pnpm`** (не npm; npm ломает тулчейн). Тесты: `pnpm test`, линт: `pnpm lint`.
- **Именование файлов в `src/` — kebab-case.**
- **Тесты — vitest**, окружение jsdom, файлы `*.test.ts` колоцированы рядом с кодом.
- **Frozen-зоны, затрагиваемые осознанно (это foundation-update):** `next.config.ts`, `src/proxy.ts`. Касание оправдано и ограничено описанным ниже.
- **Git:** НЕ использовать `git add -A`/`git add .` — добавлять только свои файлы по имени. Не делать деструктивных git-операций.
- **CSP по умолчанию — Report-Only** (`CSP_ENFORCE != "1"`). Никогда не выкатывать enforce до сбора нарушений.
- **Origin'ы — из env** (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORAGE_URL`); пустое значение → внешний origin не добавляется.
- **Перед PR зелёные:** `pnpm lint && pnpm test && pnpm build`.

## File Structure

- **Create** `src/security/csp.ts` — билдеры CSP-строки, имя заголовка по режиму, резолв origin, генерация nonce, композитный `buildSecurityHeaders()`.
- **Create** `src/security/csp.test.ts` — юнит-тесты билдеров.
- **Create** `src/security/security-headers.ts` — список статических security-заголовков (HSTS только в проде).
- **Create** `src/security/security-headers.test.ts` — юнит-тесты.
- **Create** `src/app/api/csp-report/route.ts` — приёмник violation-репортов.
- **Create** `src/app/api/csp-report/route.test.ts` — юнит-тест роута.
- **Modify** `next.config.ts` — добавить `async headers()`.
- **Modify** `src/proxy.ts` — интеграция nonce+CSP через хелпер `pageResponse`.
- **Modify** `src/proxy.test.ts` — добавить блок тестов про security-заголовки.
- **Modify** `.env.example` — задокументировать `CSP_ENFORCE`, origin-переменные (`NEXT_PUBLIC_STORAGE_URL`/`NEXT_PUBLIC_API_URL`), `NEXT_PUBLIC_ANALYTICS_ENABLED`.

---

### Task 1: CSP-билдеры (`src/security/csp.ts`)

**Files:**
- Create: `src/security/csp.ts`
- Test: `src/security/csp.test.ts`

**Interfaces:**
- Produces:
  - `interface CspParams { nonce: string; apiOrigin: string | null; storageOrigin: string | null; isDev: boolean }`
  - `interface SecurityHeaders { nonce: string; csp: string; responseHeaderName: string }`
  - `originFromUrl(url: string | undefined): string | null`
  - `cspHeaderName(enforce: boolean): string`
  - `buildCsp(params: CspParams): string`
  - `generateNonce(): string`
  - `buildSecurityHeaders(): SecurityHeaders`

- [ ] **Step 1: Write the failing test**

Create `src/security/csp.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCsp,
  buildSecurityHeaders,
  cspHeaderName,
  originFromUrl,
} from "./csp";

describe("originFromUrl", () => {
  it("возвращает origin без пути", () => {
    expect(originFromUrl("https://cdn.example.com/static/files")).toBe(
      "https://cdn.example.com",
    );
  });
  it("null для пустого/невалидного", () => {
    expect(originFromUrl(undefined)).toBeNull();
    expect(originFromUrl("")).toBeNull();
    expect(originFromUrl("не url")).toBeNull();
  });
});

describe("cspHeaderName", () => {
  it("report-only по умолчанию", () => {
    expect(cspHeaderName(false)).toBe("Content-Security-Policy-Report-Only");
  });
  it("enforce при true", () => {
    expect(cspHeaderName(true)).toBe("Content-Security-Policy");
  });
});

describe("buildCsp", () => {
  const base = { nonce: "abc123", apiOrigin: null, storageOrigin: null, isDev: false };

  it("script-src с nonce и strict-dynamic, без unsafe-inline", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
  it("style-src сохраняет unsafe-inline", () => {
    expect(buildCsp(base)).toContain("style-src 'self' 'unsafe-inline'");
  });
  it("frame-ancestors none и object-src none", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("добавляет внешние origin в img-src и connect-src", () => {
    const csp = buildCsp({
      ...base,
      apiOrigin: "https://api.example.com",
      storageOrigin: "https://cdn.example.com",
    });
    expect(csp).toContain("img-src 'self' data: blob: https://cdn.example.com");
    expect(csp).toContain(
      "connect-src 'self' https://api.example.com https://cdn.example.com",
    );
  });
  it("без внешних origin когда null", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("connect-src 'self';");
  });
  it("unsafe-eval и ws: только в dev", () => {
    const dev = buildCsp({ ...base, isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
    expect(buildCsp(base)).not.toContain("'unsafe-eval'");
    expect(buildCsp(base)).not.toContain("ws:");
  });
  it("директивы репортинга", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
  });
  it("worker-src и manifest-src 'self'", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
  });
  it("upgrade-insecure-requests в проде, не в dev", () => {
    expect(buildCsp(base)).toContain("upgrade-insecure-requests");
    expect(buildCsp({ ...base, isDev: true })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("buildSecurityHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("report-only по умолчанию, enforce при CSP_ENFORCE=1", () => {
    vi.stubEnv("CSP_ENFORCE", "");
    expect(buildSecurityHeaders().responseHeaderName).toBe(
      "Content-Security-Policy-Report-Only",
    );
    vi.stubEnv("CSP_ENFORCE", "1");
    expect(buildSecurityHeaders().responseHeaderName).toBe(
      "Content-Security-Policy",
    );
  });
  it("nonce непустой и присутствует в csp", () => {
    const sec = buildSecurityHeaders();
    expect(sec.nonce.length).toBeGreaterThan(0);
    expect(sec.csp).toContain(`'nonce-${sec.nonce}'`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/security/csp.test.ts`
Expected: FAIL — `Failed to resolve import "./csp"` / функции не определены.

- [ ] **Step 3: Write minimal implementation**

Create `src/security/csp.ts`:

```ts
// src/security/csp.ts
// Чистые билдеры Content-Security-Policy. Side-effect'ы только в generateNonce
// (Web Crypto) и buildSecurityHeaders (читает env). Обоснование политики —
// docs/superpowers/specs/2026-06-20-csp-security-headers-design.md
export interface CspParams {
  nonce: string;
  apiOrigin: string | null;
  storageOrigin: string | null;
  isDev: boolean;
}

export interface SecurityHeaders {
  nonce: string;
  /** Значение политики (одинаково для request и response). */
  csp: string;
  /** Имя заголовка ответа: enforce vs report-only. */
  responseHeaderName: string;
}

export function originFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function cspHeaderName(enforce: boolean): string {
  return enforce
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

export function buildCsp({
  nonce,
  apiOrigin,
  storageOrigin,
  isDev,
}: CspParams): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ...(storageOrigin ? [storageOrigin] : []),
  ];
  const externalOrigins = [apiOrigin, storageOrigin].filter(
    (o): o is string => o !== null,
  );
  const connectSrc = [
    "'self'",
    ...new Set(externalOrigins),
    ...(isDev ? ["ws:"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildSecurityHeaders(): SecurityHeaders {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    apiOrigin: originFromUrl(process.env.NEXT_PUBLIC_API_URL),
    // storage резолвится ТАК ЖЕ, как в src/utils/storage-url.ts: STORAGE || API.
    // ВАЖНО: эти переменные должны быть заданы перед CSP_ENFORCE=1, иначе
    // cross-origin картинки/запросы заблокируются (см. .env.example, Task 6).
    storageOrigin: originFromUrl(
      process.env.NEXT_PUBLIC_STORAGE_URL || process.env.NEXT_PUBLIC_API_URL,
    ),
    isDev: process.env.NODE_ENV !== "production",
  });
  return {
    nonce,
    csp,
    responseHeaderName: cspHeaderName(process.env.CSP_ENFORCE === "1"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/security/csp.test.ts`
Expected: PASS (все кейсы).

- [ ] **Step 5: Commit**

```bash
git add src/security/csp.ts src/security/csp.test.ts
git commit -m "feat(security): CSP policy builders + nonce"
```

---

### Task 2: Статические security-заголовки (`src/security/security-headers.ts`)

**Files:**
- Create: `src/security/security-headers.ts`
- Test: `src/security/security-headers.test.ts`

**Interfaces:**
- Produces:
  - `interface HeaderKV { key: string; value: string }`
  - `staticSecurityHeaders(isProd: boolean): HeaderKV[]`

- [ ] **Step 1: Write the failing test**

Create `src/security/security-headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { staticSecurityHeaders } from "./security-headers";

describe("staticSecurityHeaders", () => {
  it("всегда содержит nosniff/referrer/frame/permissions", () => {
    const keys = staticSecurityHeaders(false).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "Referrer-Policy",
        "X-Frame-Options",
        "Permissions-Policy",
      ]),
    );
  });
  it("nosniff именно nosniff", () => {
    const h = staticSecurityHeaders(false).find(
      (x) => x.key === "X-Content-Type-Options",
    );
    expect(h?.value).toBe("nosniff");
  });
  it("без HSTS вне прода", () => {
    const keys = staticSecurityHeaders(false).map((h) => h.key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });
  it("HSTS в проде", () => {
    const hsts = staticSecurityHeaders(true).find(
      (h) => h.key === "Strict-Transport-Security",
    );
    expect(hsts?.value).toContain("max-age=31536000");
    expect(hsts?.value).not.toContain("preload");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/security/security-headers.test.ts`
Expected: FAIL — import не резолвится.

- [ ] **Step 3: Write minimal implementation**

Create `src/security/security-headers.ts`:

```ts
// src/security/security-headers.ts
// Статические security-заголовки (не зависят от запроса). Применяются глобально
// через next.config.ts headers(). HSTS — только в проде, без preload (необратимо).
export interface HeaderKV {
  key: string;
  value: string;
}

export function staticSecurityHeaders(isProd: boolean): HeaderKV[] {
  const headers: HeaderKV[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), browsing-topics=(), " +
        "payment=(), usb=(), serial=(), bluetooth=(), hid=(), " +
        "accelerometer=(), gyroscope=(), magnetometer=(), " +
        "xr-spatial-tracking=(), display-capture=(), idle-detection=()",
    },
  ];
  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/security/security-headers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/security/security-headers.ts src/security/security-headers.test.ts
git commit -m "feat(security): static security headers list"
```

---

### Task 3: Подключить статические заголовки в `next.config.ts`

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `staticSecurityHeaders(isProd)` из Task 2.

- [ ] **Step 1: Modify next.config.ts (НЕ заменять файл целиком)**

Добавить ТОЛЬКО две вещи в существующий файл. Существующие комментарии и поля
(`reactCompiler`/`reactStrictMode`/`images`/`experimental`) НЕ трогать.

(а) импорт (в группе относительных путей, после существующих import'ов):

```ts
import { staticSecurityHeaders } from "./src/security/security-headers";
```

(б) метод `async headers()` внутрь объекта `nextConfig` (например, после блока `experimental`):

```ts
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
```

- [ ] **Step 2: Verify build accepts the config**

Run: `pnpm build`
Expected: сборка проходит без ошибок конфигурации (заголовки валидны).

- [ ] **Step 3: Verify headers are served (ручная проверка)**

Запусти dev-сервер (`pnpm dev`, в фоне) и проверь заголовки (порт — из вывода dev-сервера, обычно 3000/3001):

Run: `curl -sI http://localhost:3000/ | grep -iE "x-content-type-options|referrer-policy|x-frame-options|permissions-policy"`
Expected: четыре строки присутствуют (`x-content-type-options: nosniff` и т.д.). Останови dev-сервер после проверки.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): wire static security headers via next.config headers()"
```

---

### Task 4: Интеграция nonce+CSP в middleware (`src/proxy.ts`)

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `buildSecurityHeaders()`, `SecurityHeaders` из Task 1.

**Контекст интеграции (важно):** Next извлекает nonce из **request**-заголовка `Content-Security-Policy` и проставляет его своим framework-скриптам — поэтому nonce кладётся и в request (имя `Content-Security-Policy`, всегда), и в ответ (имя по режиму). Все ответы, рендерящие страницу (`NextResponse.next`), проходят через единый хелпер `pageResponse`. Редиректы страницу не рендерят — их не трогаем.

- [ ] **Step 1: Write the failing test**

Добавить в КОНЕЦ `src/proxy.test.ts` новый блок (не меняя существующие тесты):

```ts
describe("middleware — security headers (CSP)", () => {
  it("гость получает Report-Only CSP с nonce на странице", async () => {
    const res = await proxy(req({}));
    const csp = res.headers.get("content-security-policy-report-only");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    // enforce-заголовка быть не должно (по умолчанию report-only)
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("nonce уникален на каждый запрос", async () => {
    const a = await proxy(req({}));
    const b = await proxy(req({}));
    const nonceA = a.headers
      .get("content-security-policy-report-only")
      ?.match(/'nonce-([^']+)'/)?.[1];
    const nonceB = b.headers
      .get("content-security-policy-report-only")
      ?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonceA).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
  });

  it("объявлен Reporting-Endpoints", async () => {
    const res = await proxy(req({}));
    expect(res.headers.get("reporting-endpoints")).toContain("csp-endpoint");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/proxy.test.ts`
Expected: FAIL — заголовка `content-security-policy-report-only` нет.

- [ ] **Step 3: Implement — добавить импорт и хелпер**

В `src/proxy.ts` добавить импорт. ВАЖНО для `import/order` (alphabetize asc внутри
группы внутренних `@/`): строка идёт СРАЗУ ПОСЛЕ импорта `@/features/auth/cookie-config`
(`features` < `security`), без пустой строки между ними:

```ts
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "@/features/auth/cookie-config";
import { buildSecurityHeaders, type SecurityHeaders } from "@/security/csp";
```

Добавить module-level хелпер (например, сразу перед `export async function proxy`):

```ts
/**
 * Ответ, рендерящий страницу, с проставленными CSP+nonce.
 * Nonce кладётся в request-заголовок Content-Security-Policy (Next извлекает
 * его и стампит на свои скрипты) и в ответ — под именем по режиму (enforce/report-only).
 */
function pageResponse(request: NextRequest, sec: SecurityHeaders): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", sec.nonce);
  // Request-заголовок Content-Security-Policy — ТОЛЬКО для render-слоя: Next
  // извлекает из него nonce и стампит на свои скрипты. В браузер он НЕ уходит
  // (браузер видит лишь res.headers ниже). Поэтому имя тут всегда enforce-имя
  // (для извлечения nonce), а фактический режим задаёт sec.responseHeaderName на
  // ОТВЕТЕ. НЕ отражай этот request-заголовок в ответ.
  requestHeaders.set("Content-Security-Policy", sec.csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // НЕ добавляй 'unsafe-inline' в script-src как «фолбэк»: современные браузеры
  // игнорируют его при наличии nonce, а на игнорящих nonce он заново открывает XSS.
  res.headers.set(sec.responseHeaderName, sec.csp);
  res.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  return res;
}
```

- [ ] **Step 4: Implement — прокинуть sec в proxy() и performRefresh()**

В `proxy()`: в самом начале тела (первой строкой) добавить:

```ts
  const sec = buildSecurityHeaders();
```

Заменить вызов refresh:

```ts
    const { response, refreshedAccess } = await performRefresh(request, refresh);
```

на:

```ts
    const { response, refreshedAccess } = await performRefresh(request, refresh, sec);
```

Заменить финальный возврат:

```ts
  return pending ?? NextResponse.next({ request });
```

на:

```ts
  return pending ?? pageResponse(request, sec);
```

В сигнатуре `performRefresh` добавить параметр `sec`:

```ts
async function performRefresh(
  request: NextRequest,
  refresh: string,
  sec: SecurityHeaders,
): Promise<{ response: NextResponse; refreshedAccess: string | null }> {
```

В ветке ошибки заменить:

```ts
    const errRes = NextResponse.next({ request });
```

на:

```ts
    const errRes = pageResponse(request, sec);
```

В ветке успеха заменить:

```ts
  const successRes = NextResponse.next({ request });
```

на:

```ts
  const successRes = pageResponse(request, sec);
```

(Операции `errRes.cookies.delete(...)` / `successRes.cookies.set(...)` остаются как есть — они выполняются на ответе от `pageResponse`. Редиректы `NextResponse.redirect(...)` НЕ трогаем.)

- [ ] **Step 5: Run tests to verify all pass**

Run: `pnpm test src/proxy.test.ts`
Expected: PASS — и новые CSP-тесты, и все существующие (refresh/admin-гейт не сломаны: cookie по-прежнему ставятся/чистятся на ответе).

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat(security): per-request nonce CSP in middleware (report-only)"
```

---

### Task 5: Приёмник violation-репортов (`/api/csp-report`)

**Files:**
- Create: `src/app/api/csp-report/route.ts`
- Test: `src/app/api/csp-report/route.test.ts`

**Interfaces:**
- Consumes: `log` из `@/services/observability`, `initServerObservability` из `@/services/observability/server`.
- Produces: `POST(req: Request): Promise<Response>` — всегда `204`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/csp-report/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/observability/server", () => ({
  initServerObservability: vi.fn(),
}));

const warn = vi.fn();
vi.mock("@/services/observability", () => ({
  log: { warn: (...a: unknown[]) => warn(...a) },
}));

import { POST } from "./route";

describe("POST /api/csp-report", () => {
  it("логирует валидный репорт и отвечает 204", async () => {
    warn.mockClear();
    const body = JSON.stringify({ "csp-report": { "violated-directive": "script-src" } });
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body }),
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("csp.violation", expect.any(Object));
  });

  it("не падает на битом теле, отвечает 204", async () => {
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body: "{не json" }),
    );
    expect(res.status).toBe(204);
  });

  it("принимает массивный конверт application/reports+json", async () => {
    warn.mockClear();
    const body = JSON.stringify([
      { type: "csp-violation", body: { effectiveDirective: "script-src" } },
    ]);
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body }),
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("csp.violation", expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/api/csp-report/route.test.ts`
Expected: FAIL — `./route` не существует.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/csp-report/route.ts`:

```ts
// src/app/api/csp-report/route.ts
// Same-origin приёмник CSP violation-репортов. Без бэкенд-ингеста: логируем
// через серверный observability. Подробности — в дизайн-доке CSP.
import { log } from "@/services/observability";
import { initServerObservability } from "@/services/observability/server";

export async function POST(req: Request): Promise<Response> {
  initServerObservability();
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  log.warn("csp.violation", { report: JSON.stringify(body).slice(0, 4000) });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/api/csp-report/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/csp-report/route.ts src/app/api/csp-report/route.test.ts
git commit -m "feat(security): CSP violation report endpoint"
```

---

### Task 6: Документация env (`.env.example`)

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Добавить блоки Security/CSP и Analytics в конец `.env.example`**

```bash
# ───────────────────────── Security / CSP ─────────────────────────
# Режим CSP: пусто/0 → Report-Only (только репорты), "1" → enforce (блокировка).
# По умолчанию Report-Only. НЕ выставляй "1", пока на проде не собраны нулевые
# нарушения на /api/csp-report И не заданы origin-переменные ниже.
CSP_ENFORCE=
# Origin'ы, которые CSP разрешает браузеру для картинок (img-src) и fetch/XHR
# (connect-src) — хранилище/CDN и API. Резолв storage = STORAGE || API
# (как в src/utils/storage-url.ts). ОБЯЗАТЕЛЬНЫ перед CSP_ENFORCE=1, иначе
# cross-origin картинки/запросы заблокируются. Серверный API_URL тут НЕ при чём.
NEXT_PUBLIC_STORAGE_URL=
NEXT_PUBLIC_API_URL=

# ───────────────────────── Analytics ─────────────────────────
# Yandex Metrika отключена по умолчанию (см. docs/analytics-consent.md).
# Включать ТОЛЬКО вместе с opt-in consent-механизмом. "1" → грузить Метрику.
NEXT_PUBLIC_ANALYTICS_ENABLED=
# ID счётчика Метрики (используется только при NEXT_PUBLIC_ANALYTICS_ENABLED=1).
NEXT_PUBLIC_YM_COUNTER_ID=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(security): document CSP/analytics env flags in .env.example"
```

---

### Task 7: Финальная проверка ворот

**Files:** —

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: чисто.

- [ ] **Step 2: Tests**

Run: `pnpm test`
Expected: все тесты зелёные (включая существующие 1891+).

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: сборка проходит.

- [ ] **Step 4: Ручная проверка CSP в браузере (Report-Only)**

Запусти `pnpm dev`, открой страницу, DevTools → Network → заголовки документа: присутствует `Content-Security-Policy-Report-Only` со свежим `nonce-…`. Консоль не должна блокировать скрипты (это Report-Only). Любые нарушения уедут на `/api/csp-report` — проверь, что приложение работает (навигация, формы). Останови dev-сервер.

> **Переключение на enforce — отдельным шагом позже:** после сбора нулевых нарушений на проде выставить env `CSP_ENFORCE=1`. Это конфиг, не правка кода.

---

## Self-Review

**1. Spec coverage:**
- §4.1 nonce-flow → Task 4 (pageResponse, request+response заголовки). ✓
- §4.2 поток репортов (report-to + Reporting-Endpoints + route) → Task 4 (заголовок) + Task 5 (route). ✓
- §5 директивы CSP → Task 1 (buildCsp) + тесты. ✓
- §5.2 style-src unsafe-inline → Task 1 (зафиксировано, тест проверяет сохранение). ✓
- §6 Report-Only → enforce по `CSP_ENFORCE` → Task 1 (`cspHeaderName`/`buildSecurityHeaders`) + Task 6 (переключение). ✓
- §7 статические заголовки → Task 2 + Task 3. ✓
- §11 dev WS/HMR (`ws:`, `'unsafe-eval'`) → Task 1 (ветка isDev) + тест. ✓
- §11 прод-origin параметризация → Task 1 (`originFromUrl` из env, пусто→без origin) + тест. ✓
- §8 бэкенд — обязательных нет; комплементарные вне scope этого плана. ✓

**2. Placeholder scan:** плейсхолдеров нет; весь код приведён целиком. ✓

**3. Type consistency:** `SecurityHeaders { nonce, csp, responseHeaderName }` — одинаково в Task 1 и Task 4. `buildSecurityHeaders()` возвращает его же. `HeaderKV { key, value }` — Task 2 и потребление в Task 3 (`headers: HeaderKV[]` совместимо с форматом Next `{ key, value }`). `log.warn(message, attributes)` — соответствует facade. ✓
