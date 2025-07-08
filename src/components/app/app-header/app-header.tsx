import Link from "next/link";
import Image from "next/image";
import { NavigationMenu } from "@base-ui-components/react";

import { AppNav } from "../app-nav";
// import { DnaIcon } from "@/assets/icons/dna-icon";
import { NetworkIndicator } from "../network-indicator";
import { DropdownArrowIcon } from "@/assets/icons/dropdown-arrow-icon";

import "./app-header.css";

export const AppHeader: React.FC = async () => {
  return (
    <header
      className="app-header sticky top-0 z-50 w-full flex justify-center items-stretch gap-4 bg-(--background) border-b border-t border-(--border)"
      style={{ height: "var(--header-height)" }}
    >
      <NavigationMenu.Root className="w-full max-w-[100vw] lg:max-w-screen-lg md:border-l md:border-r border-(--border) bg-(--background) pl-4 pr-4">
        <NavigationMenu.List className="relative grid grid-cols-[auto_auto_auto_1fr] gap-4 w-full h-full items-stretch">
          <NavigationMenu.Item className="flex items-center">
            <Link href="/">
              <Image
                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/logo.png`}
                alt="Logo image"
                width={40}
                height={40}
                sizes="50px"
                priority
                className="grayscale hover:grayscale-0"
              />
            </Link>
          </NavigationMenu.Item>
          {/* <NavigationMenu.Item className="flex items-center">
            <Link href="/graph">
              <DnaIcon className="w-[30px] h-[30px] text-(--primary)" />
            </Link>
          </NavigationMenu.Item> */}
          <AppNav />
          <div />
        </NavigationMenu.List>

        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            sideOffset={10}
            collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
            className={positionerClassName}
            style={{
              ["--duration" as string]: "0.35s",
              ["--easing" as string]: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <NavigationMenu.Popup className={popupClassName}>
              <NavigationMenu.Arrow className={arrowClassName}>
                <DropdownArrowIcon />
              </NavigationMenu.Arrow>
              <NavigationMenu.Viewport className="relative h-full w-full overflow-hidden" />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>

        <NetworkIndicator
        // className="text-xl"
        />
      </NavigationMenu.Root>
    </header>
  );
};

const positionerClassName =
  "box-border h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-[instant]:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5";

const popupClassName =
  "w-full rounded bg-(--background) border border-(--border) data-[ending-style]:easing-[ease] relative h-[var(--popup-height)] origin-[var(--transform-origin)] transition-[opacity,transform,width,height,scale,translate] duration-[var(--duration)] ease-[var(--easing)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 min-[500px]:w-[var(--popup-width)] xs:w-[var(--popup-width)]";

const arrowClassName =
  "flex transition-[left] duration-[var(--duration)] ease-[var(--easing)] data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180";
