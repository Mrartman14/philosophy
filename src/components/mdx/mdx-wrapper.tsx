"use client";

import { useEffect, useState } from "react";
import { MDXComponents } from "mdx/types";

import { AsideMenu, AsideNavItem } from "../shared/aside-menu";

const contentId = "docs-content";
export const MDXWrapper: React.FC<MDXComponents["wrapper"]> = ({
  params,
  searchParams,
  children,
}) => {
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useEffect(() => {
    const contentEl = document.getElementById(contentId);
    if (!contentEl) return;

    const headings = Array.from(
      contentEl.querySelectorAll("[data-heading-id]")
    );

    type HeadingObject = {
      el: Element;
      text: string | null;
      level: number;
      children: HeadingObject[];
    };

    const headingObjects: HeadingObject[] = headings.map((el) => ({
      el,
      text: el.textContent,
      level: parseInt(el.tagName.substring(1), 10),
      children: [],
    }));

    const root: HeadingObject[] = [];
    const stack: HeadingObject[] = [];

    headingObjects.forEach((heading) => {
      while (stack.length && stack[stack.length - 1]!.level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(heading);
      } else {
        stack[stack.length - 1]!.children.push(heading);
      }
      stack.push(heading);
    });

    function mapper({ children, el }: HeadingObject): AsideNavItem {
      return {
        id: el.getAttribute("data-heading-id") ?? "???",
        children: children?.map(mapper),
        render: ({ isSelected, depth }) => (
          <span
            className={`pl-${depth * 4} ${
              isSelected ? "underline underline-offset-4" : "no-underline"
            }`}
          >
            {el.getAttribute("data-title-id")}
          </span>
        ),
      };
    }

    const result: AsideNavItem[] = root.map(mapper);

    setAsideItems(result);
  }, []);

  return (
    <div className="grid gap-4 static w-full items-start justify-items-center grid-cols-[minmax(auto,_1fr)_300px]">
      <article
        id={contentId}
        className="prose dark:prose-invert text-justify lg:prose-xl"
      >
        {children}
      </article>
      <AsideMenu items={asideItems} />
    </div>
  );
};
