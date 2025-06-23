"use client";

// import Link from "next/link";
// import Image from "next/image";
import { MDXComponents } from "mdx/types";
import { useEffect, useState } from "react";

import { AsideMenu, AsideNavItem } from "../shared/aside-menu";
import { MDXOutroLink } from "./mdx-outro-link";

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

  const outroLinks = [
    {
      href: "/",
      title: "← Предыдущий урок",
      description: "Название предыдущего урока",
      imageSrc: "/lesson-previews/lesson-17-preview.jpeg",
    },
    {
      href: "/",
      title: "Следующий урок →",
      description: "Название следующего урока",
      imageSrc: "/lesson-previews/lesson-18-preview.jpeg",
    },
  ];

  return (
    <div className="grid gap-4 static w-full items-start justify-items-center grid-cols-[minmax(auto,_1fr)_300px]">
      <article
        id={contentId}
        className="prose dark:prose-invert text-justify lg:prose-xl p-4 border-l border-r border-gray-200 dark:border-gray-700"
      >
        {/* <div
          className="relative bg-cover bg-center"
          style={{
            width: "100%",
            height: "auto",
            backgroundImage: `url(/lesson-previews/lesson-18-preview.jpeg)`,
          }}
        >
          <h1 className="text-6xl absolute p-0.5 bottom-4 right-4 backdrop-blur-lg">
            Heading
          </h1>
        </div> */}
        {children}
        <div className="grid grid-cols-2 grid-rows-[150] gap-4 w-full">
          {outroLinks.map((link) => (
            <MDXOutroLink key={link.title} {...link} />
          ))}
        </div>
      </article>
      <AsideMenu items={asideItems} />
    </div>
  );
};
