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
  it("прод: style-src на nonce, БЕЗ unsafe-inline нигде в политике (Level 2)", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    expect(csp).not.toContain("'unsafe-inline'");
  });
  it("прод: style-src-attr 'none' — SSR inline style-атрибуты запрещены (Level 2)", () => {
    expect(buildCsp(base)).toContain("style-src-attr 'none'");
  });
  it("style-src-elem в проде: nonce (нонсенные <style> Base UI)", () => {
    expect(buildCsp(base)).toContain("style-src-elem 'self' 'nonce-abc123'");
  });
  it("dev: style-src/elem/attr оставляют unsafe-inline для HMR, без nonce", () => {
    const dev = buildCsp({ ...base, isDev: true });
    expect(dev).toContain("style-src 'self' 'unsafe-inline'");
    expect(dev).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(dev).toContain("style-src-attr 'unsafe-inline'");
    expect(dev).not.toContain("style-src-attr 'none'");
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
  it("дедуплицирует connect-src при apiOrigin === storageOrigin", () => {
    const csp = buildCsp({
      ...base,
      apiOrigin: "https://api.example.com",
      storageOrigin: "https://api.example.com",
    });
    expect(csp).toContain("connect-src 'self' https://api.example.com;");
    expect(csp).not.toContain(
      "https://api.example.com https://api.example.com",
    );
  });
  it("без внешних origin когда null", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("img-src 'self' data: blob:");
    // "; " — разделитель директив: после connect-src 'self' идёт "; <next-directive>"
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
