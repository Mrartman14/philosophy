"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const stickyRef = useRef(null);
  const sentinelRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  const [intersected, setIntersected] = useState<string | null>();

  useLayoutEffect(() => {
    setIntersected(items[0]?.id);
  }, [items]);

  useLayoutEffect(() => {
    function listen() {
      const elements: { el: HTMLElement; id: string }[] = [];

      items.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return;
        elements.push({ el, id });
      });
      for (const item of elements) {
        const { top, left } = item.el.getBoundingClientRect();
        const isIntersected = top >= 0 && left >= 0;
        if (isIntersected) {
          setIntersected(item.id);
          break;
        }
      }
    }

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
    <aside className={`w-full grid content-start ${className}`}>
      <div
        className={`px-4 border-b border-(--border) h-[${ASIDE_HEADER_HEIGHT}px] flex items-center`}
      >
        <h3 className="text-(--description) font-semibold">Содержание</h3>
      </div>
      <div ref={sentinelRef} style={{ height: 1, margin: 0, padding: 0 }} />
      <ul
        ref={stickyRef}
        className="grid gap-2 p-4 sticky top-(--header-height) self-start overflow-y-scroll"
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
  return (
    <li>
      <a
        key={item.id}
        href={`#${item.id}`}
        id={getAnchorId(item.id)}
        className={`${
          isSelected ? "" : "text-(--description) font-light"
        } hover:underline`}
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        {item.render({ isSelected, depth })}
      </a>
      {item.children?.map((child) => (
        <AsideMenuItem
          key={child.id}
          item={child}
          depth={depth + 1}
          intersected={intersected}
        />
      ))}
    </li>
  );
};

function getAnchorId(id: string) {
  return `${id}-anchor`;
}
