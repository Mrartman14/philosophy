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
  const [atTop, setAtTop] = useState(true);
  const [intersected, setIntersected] = useState<string | null>();

  useLayoutEffect(() => {
    setIntersected(items[0]?.id);
  }, [items]);

  useLayoutEffect(() => {
    function listen() {
      setAtTop(window.scrollY === 0);

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
    <nav
      className={`w-full grid gap-4 content-start sticky ${className}`}
      style={{ top: "calc(var(--header-height) + 10px)" }}
    >
      <div className="grid gap-4">
        <h3 className="text-(--description) font-semibold">Содержание</h3>
      </div>
      <ul className="grid gap-4">
        {items.map((item) => (
          <AsideMenuItem
            key={item.id}
            item={item}
            depth={0}
            intersected={intersected}
          />
        ))}
      </ul>
      <div>
        <button
          className={`text-(--description) transition-opacity ${
            atTop ? "opacity-0" : "opacity-100"
          }`}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Листать вверх ↑
        </button>
      </div>
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
          isSelected ? "underline underline-offset-4" : "no-underline"
        }`}
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
