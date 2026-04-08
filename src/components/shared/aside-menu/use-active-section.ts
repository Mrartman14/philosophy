"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash/throttle";
import type { AsideNavItem } from "./aside-menu";

function flattenItems(items: AsideNavItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children?.length) {
      ids.push(...flattenItems(item.children));
    }
  }
  return ids;
}

export function useActiveSection(
  items: AsideNavItem[],
  scrollContainerRef: React.RefObject<HTMLUListElement | null>
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemIds = useMemo(() => flattenItems(items), [items]);
  const elementCache = useRef<Map<string, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    setActiveId(items[0]?.id ?? null);
    elementCache.current.clear();
  }, [items]);

  useLayoutEffect(() => {
    const getElement = (id: string): HTMLElement | null => {
      let el = elementCache.current.get(id);
      if (!el) {
        el = document.getElementById(id) ?? undefined;
        if (el) elementCache.current.set(id, el);
      }
      return el ?? null;
    };

    const listen = throttle(() => {
      for (const id of itemIds) {
        const el = getElement(id);
        if (!el) continue;
        const { top, left } = el.getBoundingClientRect();
        if (top >= 0 && left >= 0) {
          setActiveId(id);

          const container = scrollContainerRef.current;
          if (container) {
            const anchorEl = document.getElementById(`${id}-anchor`);
            if (anchorEl) {
              const containerRect = container.getBoundingClientRect();
              const anchorRect = anchorEl.getBoundingClientRect();
              container.scrollTo({
                top: container.scrollTop + (anchorRect.top - containerRect.top) - 16,
                behavior: "smooth",
              });
            }
          }
          break;
        }
      }
    }, 100);

    listen();
    document.addEventListener("scroll", listen);
    return () => document.removeEventListener("scroll", listen);
  }, [itemIds, scrollContainerRef]);

  return activeId;
}
