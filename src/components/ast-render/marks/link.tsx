// src/components/ast-render/marks/link.tsx
import type { ReactNode } from "react";

interface Props {
  href: string | undefined;
  children: ReactNode;
}

/**
 * Разрешённые href: абсолютные http(s):, относительные (начинаются с "/"),
 * якоря (начинаются с "#") и mailto:. Остальные — рендерятся как plain text.
 */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  // Reject protocol-relative URLs ("//evil.com" resolves to https://evil.com).
  if (href.startsWith("//")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("http://") || href.startsWith("https://")) return true;
  return false;
}

export function LinkMark({ href, children }: Props): ReactNode {
  if (!isSafeHref(href)) return <>{children}</>;
  const external = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      href={href}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}
