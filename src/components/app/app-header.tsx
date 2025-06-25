"use client";

import Link from "next/link";
import Image from "next/image";
import groupBy from "lodash/groupBy";
import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "@base-ui-components/react";

import { structure } from "@/structure";
import { Mention } from "../shared/mention";
import { ThemeSelect } from "./theme-select";
import { DropdownArrowIcon } from "@/assets/icons/arrow-icon";
import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";

export const AppHeader: React.FC = () => {
  const pathname = usePathname();
  const groupedByChapter = useMemo(
    () => groupBy(structure, (x) => x.section),
    []
  );
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // const { refs, floatingStyles, context } = useFloating({
  //   open: true,
  // });

  // const listRef = useRef<HTMLLIElement[]>([]);

  // const listNavigation = useListNavigation(context, {
  //   listRef,
  //   activeIndex,
  //   onNavigate: setActiveIndex,
  // });

  // const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
  //   [listNavigation]
  // );

  return (
    <header
      className="sticky top-0 z-50 w-full pl-4 pr-4 grid gap-4 grid-cols-[1fr_auto] bg-(--background) border-b border-(--border)"
      style={{ height: "var(--header-height)" }}
    >
      <NavigationMenu.Root className="flex justify-center min-w-max rounded-lg bg-(--background)">
        <NavigationMenu.List className="relative grid grid-cols-[auto_1fr] w-full h-full items-stretch">
          <NavigationMenu.Item>
            <Link href="/">
              <Image
                src={`${basePath}/logo.png`}
                alt="Logo image"
                width={49}
                height={49}
              />
            </Link>
          </NavigationMenu.Item>
          <NavigationMenu.Item className="flex items-stretch justify-center">
            <NavigationMenu.Trigger className={triggerClassName}>
              <span className="text-xl">Лекции</span>
              <NavigationMenu.Icon className="transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180">
                <ChevronDownIcon />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className={contentClassName}>
              <ul className="grid grid-cols-1 gap-2 w-[95vw] md:w-[500px] max-h-[80vh] overflow-y-scroll">
                {Object.entries(groupedByChapter).map(([chapter, data]) => {
                  return (
                    <div
                      key={chapter}
                      className="static w-full grid grid-cols-1"
                    >
                      <h6
                        className={`sticky top-0 text-(--description) bg-(--background) text-lg p-2 border-b-1 border-b-(--border) rounded text-right`}
                      >
                        {chapter}
                      </h6>
                      {data.map((item) => {
                        const href = `/lectures/${item.slug}`;
                        const isActive = pathname === href;
                        // const itemIndex = chapterIndex + index;

                        return (
                          <li
                            key={href}
                            className="p-2 rounded hover:bg-(--text-pane)"
                            // tabIndex={activeIndex === itemIndex ? 0 : -1}
                            // ref={(node) => {
                            //   if (node) {
                            //     listRef.current[index] = node;
                            //   }
                            // }}
                            // {...getItemProps()}
                          >
                            <Link
                              href={href}
                              className={`${
                                isActive ? "text-(--primary)" : ""
                              } ${linkCardClassName}`}
                            >
                              {item.order}. {item.title}
                            </Link>
                            <div className="flex gap-1 items-center flex-wrap">
                              {item.mentions.map((m, i, arr) => (
                                <Fragment key={m}>
                                  <Mention className="text-xs">
                                    {m}
                                    {i < arr.length - 1 && ","}
                                  </Mention>
                                </Fragment>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </div>
                  );
                })}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>

        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            sideOffset={10}
            collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
            className="box-border h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-[instant]:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5"
            style={{
              ["--duration" as string]: "0.35s",
              ["--easing" as string]: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <NavigationMenu.Popup className="w-full rounded bg-(--background) border border-(--border) data-[ending-style]:easing-[ease] relative h-[var(--popup-height)] origin-[var(--transform-origin)] transition-[opacity,transform,width,height,scale,translate] duration-[var(--duration)] ease-[var(--easing)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 min-[500px]:w-[var(--popup-width)] xs:w-[var(--popup-width)]">
              <NavigationMenu.Arrow className="flex transition-[left] duration-[var(--duration)] ease-[var(--easing)] data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
                <DropdownArrowIcon />
              </NavigationMenu.Arrow>
              <NavigationMenu.Viewport className="relative h-full w-full overflow-hidden" />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>

      <ThemeSelect />
    </header>
  );
};

const triggerClassName =
  "box-border flex items-center justify-center gap-1.5 " +
  "data-[popup-open]:text-(--description) " +
  "font-semibold leading-6 select-none no-underline ";

const contentClassName =
  "transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] " +
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 " +
  "data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] " +
  "data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]";

const linkCardClassName = "block no-underline hover:underline font-semibold";
