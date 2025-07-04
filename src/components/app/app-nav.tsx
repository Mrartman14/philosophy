"use client";

import Link from "next/link";
import { useMemo } from "react";
import groupBy from "lodash/groupBy";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "@base-ui-components/react/navigation-menu";

import { structure } from "@/utils/structure";
import { examsConfig } from "@/utils/exams-config";
import { Mention } from "@/components/shared/mention";
import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";

export const AppNav: React.FC = () => {
  const pathname = usePathname();
  const groupedByChapter = useMemo(
    () => groupBy(structure, (x) => x.section),
    []
  );

  return (
    <>
      <NavigationMenu.Item className="flex items-stretch justify-center">
        <NavigationMenu.Trigger className={triggerClassName}>
          <span className="text-lg">Лекции</span>
          <NavigationMenu.Icon className="transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180">
            <ChevronDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content className={contentAnimationClassName}>
          <ul className="grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[80vh] overflow-y-scroll">
            {Object.entries(groupedByChapter).map(([chapter, data]) => {
              return (
                <div key={chapter} className="static w-full grid grid-cols-1">
                  <h6
                    className={`sticky top-0 text-(--description) bg-(--background) text-lg p-2 border-b-1 border-b-(--border) rounded text-right`}
                  >
                    {chapter}
                  </h6>
                  {data.map((item) => {
                    const href = `/lectures/${item.slug}`;
                    const isActive = pathname === href;
                    const lClasses = `${
                      isActive ? "text-(--primary)" : ""
                    } group block p-2 hover:bg-(--text-pane) font-semibold focus:outline-0`;

                    return (
                      <li key={href}>
                        <Link href={href} className={lClasses}>
                          <span className="group-hover:underline group-focus:underline">
                            {item.order}. {item.title}
                          </span>
                          <div className="flex gap-1 items-center flex-wrap">
                            {item.mentions.map((m, i, arr) => (
                              <div
                                key={m}
                                className="flex items-center text-xs"
                              >
                                <Mention className="text-xs" name={m} />
                                <span>{i < arr.length - 1 && ","}</span>
                              </div>
                            ))}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </div>
              );
            })}
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item className="flex items-stretch justify-center">
        <NavigationMenu.Trigger className={triggerClassName}>
          <span className="text-lg">Тесты</span>
          <NavigationMenu.Icon className="transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180">
            <ChevronDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content className={contentAnimationClassName}>
          <ul className="grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[80vh] overflow-y-scroll">
            {examsConfig.map((item) => {
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
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </>
  );
};

const triggerClassName =
  "box-border flex items-center justify-center gap-1.5 " +
  "data-[popup-open]:text-inherit text-(--description) " +
  "font-semibold leading-6 select-none ";

const contentAnimationClassName =
  "transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] " +
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 " +
  "data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] " +
  "data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]";
