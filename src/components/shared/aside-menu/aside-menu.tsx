"use client";

import throttle from "lodash/throttle";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import "./aside-menu.css";

export type AsideNavItem = {
  render: (p: { isSelected: boolean; depth: number }) => React.ReactNode;
  id: string;
  children?: AsideNavItem[];
};
type AsideMenuProps = {
  items: AsideNavItem[];
  className?: string;
};
const ASIDE_HEADER_HEIGHT = 40;
export const AsideMenu: React.FC<AsideMenuProps> = ({ items, className }) => {
  const stickyRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  const [intersected, setIntersected] = useState<string | null>();

  useLayoutEffect(() => {
    setIntersected(items[0]?.id);
  }, [items]);

  useLayoutEffect(() => {
    const listen = throttle(() => {
      const elements: { el: HTMLElement; id: string }[] = [];

      function itemMapper(item: AsideNavItem) {
        const el = document.getElementById(item.id);
        if (!el) return;
        elements.push({ el, id: item.id });

        if (item.children?.length === 0) {
          return;
        }

        item.children?.forEach(itemMapper);
      }
      items.forEach(itemMapper);

      for (const item of elements) {
        const { top, left } = item.el.getBoundingClientRect();
        const isIntersected = top >= 0 && left >= 0;
        if (isIntersected) {
          setIntersected(item.id);

          if (stickyRef.current) {
            const scrollContainerRect =
              stickyRef.current.getBoundingClientRect();
            const scrollTargetEl = document.getElementById(
              getAnchorId(item.id)
            )!;
            const scrollTargetRect = scrollTargetEl.getBoundingClientRect();
            const scrollTop =
              stickyRef.current.scrollTop +
              (scrollTargetRect.top - scrollContainerRect.top) -
              16; // 16px = 1rem = p-4 in tailwind

            stickyRef.current.scrollTo({
              top: scrollTop,
              behavior: "smooth",
            });
          }

          break;
        }
      }
    }, 100);

    listen();
    document?.addEventListener("scroll", listen);
    return () => {
      document?.removeEventListener("scroll", listen);
    };
  }, [items]);

  useEffect(() => {
    /**
     * когда меню видно целиком с заголовком (h3), должна быть одна макисмальная высота (для скролла меню, если меню айтемов слишком много)
     * когда заголовок при скролле скрылся, максимальная высота меню должна увеличиться на высоту этого заголовка
     * */
    const sticky = stickyRef.current;
    const sentinel = sentinelRef.current;
    if (!sticky || !sentinel) return;

    const headerHeight = getComputedStyle(sticky).top || "0px";
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStuck(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${headerHeight} 0px 0px 0px`,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <aside className={`w-full h-full grid content-start ${className}`}>
      <div
        className={`px-4 border-b border-(--border) flex items-center`}
        style={{
          height: ASIDE_HEADER_HEIGHT,
          minHeight: ASIDE_HEADER_HEIGHT,
          maxHeight: ASIDE_HEADER_HEIGHT,
        }}
      >
        <h3 className="text-(--description) font-semibold">Содержание</h3>
      </div>
      <div ref={sentinelRef} style={{ height: 1, margin: 0, padding: 0 }} />
      <ul
        ref={stickyRef}
        className="grid p-4 sticky top-(--header-height) self-start overflow-y-scroll"
        style={{
          maxHeight: stuck
            ? `calc(100vh - var(--header-height))`
            : `calc(100vh - var(--header-height) - ${ASIDE_HEADER_HEIGHT}px)`,
        }}
      >
        {items.map((item) => (
          <AsideMenuItem
            key={item.id}
            item={item}
            depth={0}
            intersected={intersected}
          />
        ))}
      </ul>
    </aside>
  );
};

type AsideMenuItemProps = {
  item: AsideNavItem;
  depth: number;
  intersected?: string | null;
};
const AsideMenuItem: React.FC<AsideMenuItemProps> = ({
  item,
  depth,
  intersected,
}) => {
  const isSelected = intersected === item.id;
  const hasChildren = (item.children ?? []).length > 0;

  return (
    <li className="aside-menu-item">
      <a
        key={item.id}
        href={`#${item.id}`}
        id={getAnchorId(item.id)}
        className={`${
          isSelected ? "" : "text-(--description)"
        } hover:underline`}
      >
        {item.render({ isSelected, depth })}
      </a>
      {hasChildren && (
        <ul className={`pl-4 border-l border-(--border)`}>
          {item.children?.map((child) => (
            <AsideMenuItem
              key={child.id}
              item={child}
              depth={depth + 1}
              intersected={intersected}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

function getAnchorId(id: string) {
  return `${id}-anchor`;
}
