// src/components/ui/router-link.tsx
import NextLink from "next/link";
import type { ComponentProps } from "react";

import { cn } from "./cn";
import { RouterLinkBusy } from "./router-link-busy";

export type RouterLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: string;
  /** false — когда волну рисует предок-контейнер через :has([data-link-pending]). Default true. */
  selfBusyIndicator?: boolean;
};

// Тонкая обёртка над next/link с self-paint шиммером навигации.
// ref — через React 19 bare-prop (течёт в ...rest): осознанное отклонение от
// forwardRef-кита, т.к. next/link принимает ref как обычный проп и компонент
// server-совместим. См. спеку.
export function RouterLink({
  href,
  target,
  rel,
  className,
  selfBusyIndicator = true,
  children,
  ...rest
}: RouterLinkProps) {
  return (
    <NextLink
      href={href}
      target={target}
      rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
      className={cn(selfBusyIndicator && "router-link", className)}
      {...rest}
    >
      {children}
      <RouterLinkBusy />
    </NextLink>
  );
}
