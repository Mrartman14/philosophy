"use client";

import { Fragment, useLayoutEffect, useState } from "react";
import { ScrollProgressBar } from "./scroll-progress-bar";

export type AsideNavItem = {
  render: (p: { isSelected: boolean; depth: number }) => React.ReactNode;
  id: string;
  children?: AsideNavItem[];
};
type AsideMenuProps = {
  items: AsideNavItem[];
};
export const AsideMenu: React.FC<AsideMenuProps> = ({ items }) => {
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
    <div className="w-full grid gap-4 content-start sticky top-[var(--header-height)]">
      <div className="grid gap-4">
        <h3>Содержание</h3>
        <ScrollProgressBar />
      </div>
      {items.map((item) => (
        <AsideMenuItem
          key={item.id}
          item={item}
          depth={0}
          intersected={intersected}
        />
      ))}
    </div>
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
    <Fragment>
      <a
        key={item.id}
        href={`#${item.id}`}
        className={`text-(--link) ${
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
    </Fragment>
  );
};
