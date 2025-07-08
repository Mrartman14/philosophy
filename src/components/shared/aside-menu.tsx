"use client";

import { useLayoutEffect, useState } from "react";

export type AsideNavItem = {
  render: (p: { isSelected: boolean; depth: number }) => React.ReactNode;
  id: string;
  children?: AsideNavItem[];
};
type AsideMenuProps = {
  items: AsideNavItem[];
  className?: string;
};
export const AsideMenu: React.FC<AsideMenuProps> = ({ items, className }) => {
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

  return (
    <nav className={`w-full grid gap-2 content-start ${className}`}>
      <div className="px-4 border-b border-(--border) h-[40px] flex items-center">
        <h3 className="text-(--description) font-semibold">Содержание</h3>
      </div>
      <ul
        className="grid gap-2 px-4 py-1 sticky top-(--header-height) overflow-y-scroll"
        style={{ maxHeight: "calc(100vh - var(--header-height)) - 41px" }}
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
    </nav>
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
