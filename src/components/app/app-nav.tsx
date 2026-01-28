"use client";

import Link from "next/link";
// import { useEffect } from "react";
import { usePathname, useParams } from "next/navigation";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import {
  groupByNestedSection,
  type SectionNode,
} from "@/utils/group-by-nested-section";
import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

type AppNavProps = object;
export const AppNav: React.FC<AppNavProps> = () => {
  const params = useParams();
  const pathname = usePathname();
  const { exams, lectures } = useAppPageConfig();
  const activeSlug = params?.slug as string | undefined;

  // useEffect(() => {
  //   if (!activeSlug) return;
  //   const element = document.getElementById(`${activeSlug}`);
  //   if (element) {
  //     element.scrollIntoView({ block: "center" });
  //   }
  // }, [activeSlug]);

  const sectionTree = groupByNestedSection(lectures);

  // TODO: сделать это еще и collapsible, а также сделать захват фокуса и скролла при открытом меню
  const renderSectionNode = (node: SectionNode, depth: number = 0) => {
    return (
      <li key={node.name} className="w-full grid grid-cols-1">
        <h6
          className="sticky text-(--description) bg-(--background) p-2 border-b border-b-(--border) text-right tracking-wider"
          style={{
            top: `calc(${depth} * (1lh + 1rem))`,
            zIndex: 10 - depth,
          }}
        >
          {node.name}
        </h6>
        <ol>
          {node.lectures.map((item) => {
            const href = `/lectures/${item.slug}`;
            const isActive = item.slug === activeSlug;
            const lClasses = `${
              isActive ? "text-(--primary)" : ""
            } group block p-2 hover:bg-(--text-pane) font-semibold focus:outline-0`;

            return (
              <li key={href} id={item.slug}>
                <Link href={href} className={lClasses}>
                  <span className="group-hover:underline group-focus:underline">
                    {item.order}. {item.title}
                  </span>
                  <div className="flex gap-1 items-center flex-wrap">
                    {item.mentions.map((m, i, arr) => (
                      <span
                        key={m}
                        className="flex items-center text-xs text-(--description)"
                      >
                        {m}
                        {i < arr.length - 1 && ","}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
        {/* Вложенные подразделы */}
        {node.children.length > 0 && (
          <ul>
            {node.children.map((child) => renderSectionNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <NavigationMenu.Item className="flex items-stretch justify-center">
        <NavigationMenu.Trigger className={triggerClassName}>
          <span className="tracking-wide">Лекции</span>
          <NavigationMenu.Icon className={chevronClassName}>
            <ChevronDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content className={contentAnimationClassName}>
          <ul className={contentListClassName}>
            {sectionTree.map((node) => renderSectionNode(node, 0))}
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item className="flex items-stretch justify-center">
        <NavigationMenu.Trigger className={triggerClassName}>
          <span className="tracking-wide">Тесты</span>
          <NavigationMenu.Icon className={chevronClassName}>
            <ChevronDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content className={contentAnimationClassName}>
          <ol className={contentListClassName}>
            {exams.map((item) => {
              const href = `/exams/${item.slug}`;
              const isActive = pathname === href;
              const lClasses = `${
                isActive ? "text-(--primary)" : ""
              } group flex flex-col p-2 hover:bg-(--text-pane) font-semibold focus:outline-0`;

              return (
                <li key={item.title}>
                  <Link href={href} className={lClasses}>
                    <span className="group-hover:underline group-focus:underline">
                      {item.order}. {item.title}
                    </span>
                    <span className="text-xs text-(--description)">
                      {item.description}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </>
  );
};

const chevronClassName =
  "text-xs " +
  "transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180 ";

const contentListClassName =
  "grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[70vh] overflow-y-scroll ";

const triggerClassName =
  "md:text-base " +
  "flex items-center justify-center gap-1 md:gap-1 " +
  "data-[popup-open]:text-inherit text-(--description) " +
  "font-semibold select-none ";

const contentAnimationClassName =
  "transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] " +
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 " +
  "data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] " +
  "data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]";
