"use client";

import Link from "next/link";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

export const AppNav: React.FC = () => {
  const { lectures } = useAppPageConfig();

  return (
    <NavigationMenu.Item className="flex items-stretch justify-center">
      <NavigationMenu.Trigger className={triggerClassName}>
        <span className="tracking-wide">Лекции</span>
        <NavigationMenu.Icon className={chevronClassName}>
          <ChevronDownIcon />
        </NavigationMenu.Icon>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className={contentAnimationClassName}>
        <ol className={contentListClassName}>
          {lectures.map((item) => {
            const href = `/lectures/${item.id}`;
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="group block p-2 hover:bg-(--text-pane) font-semibold focus:outline-0"
                >
                  <span className="group-hover:underline group-focus:underline">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-(--description)">
                      {item.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
};

const chevronClassName =
  "text-xs transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180";

const contentListClassName =
  "grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[70vh] overflow-y-scroll";

const triggerClassName =
  "md:text-base flex items-center justify-center gap-1 md:gap-1 " +
  "data-[popup-open]:text-inherit text-(--description) font-semibold select-none";

const contentAnimationClassName =
  "transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] " +
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 " +
  "data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] " +
  "data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]";
