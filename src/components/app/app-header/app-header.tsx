import { NavigationMenu } from "@base-ui/react/navigation-menu";


import { DropdownArrowIcon } from "@/assets/icons/dropdown-arrow-icon";
import { LogoIcon } from "@/assets/icons/logo-icon";
import { RouterLink } from "@/components/ui";
import { NotificationBell, getNotificationCounts } from "@/features/notifications";
import { SearchInput } from "@/features/search";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { NetworkIndicator } from "../network-indicator";

export const AppHeader = async () => {
  const me = await getMe();
  const counts = me
    ? await getNotificationCounts().catch(() => ({ unread: 0, unseen: 0 }))
    : null;
  const t = await getT("common");
  return (
    <header className="relative sticky top-0 z-50 w-full flex justify-center items-stretch gap-4 bg-(--color-surface) border-t-0 border-b md:border-t border-(--color-border) h-(--header-height) before:content-[''] before:absolute before:bottom-[calc(100%+1px)] before:left-0 before:w-full before:h-[300px] before:backdrop-blur-[8px]">
      <NavigationMenu.Root className="w-full max-w-[100vw] lg:max-w-screen-lg md:border-l md:border-r border-(--color-border) bg-(--color-surface) pl-4 pr-4">
        <NavigationMenu.List className="relative grid grid-cols-[auto_auto_auto_1fr_auto] gap-4 w-full h-full items-stretch">
          <NavigationMenu.Item className="flex items-stretch">
            <RouterLink href="/" className="flex group">
              <LogoIcon className="text-3xl text-(--color-fg-muted) group-hover:text-(--color-accent) self-center" />
            </RouterLink>
          </NavigationMenu.Item>
          <NavigationMenu.Item className="flex items-center gap-4">
            <RouterLink
              href="/calendar"
              className="text-sm text-(--color-fg-muted) hover:text-(--color-accent)"
            >
              {t("nav.calendar")}
            </RouterLink>
            <RouterLink
              href="/trails"
              className="text-sm text-(--color-fg-muted) hover:text-(--color-accent)"
            >
              {t("nav.trails")}
            </RouterLink>
          </NavigationMenu.Item>
          <div className="flex gap-2 items-center">
            <SearchInput variant="header" />
            <NetworkIndicator className="text-xl" />
            {me ? (
              <>
                <NotificationBell initialCounts={counts ?? { unread: 0, unseen: 0 }} />
                <RouterLink
                  href="/canvases"
                  className="text-sm text-(--color-fg-muted) hover:text-(--color-accent)"
                >
                  {t("nav.canvases")}
                </RouterLink>
                <RouterLink
                  href="/me"
                  className="text-sm text-(--color-fg-muted) hover:text-(--color-accent)"
                >
                  {me.username}
                </RouterLink>
              </>
            ) : (
              <RouterLink
                href="/login"
                className="text-sm text-(--color-fg-muted) hover:text-(--color-accent)"
              >
                {t("nav.login")}
              </RouterLink>
            )}
          </div>
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
      </NavigationMenu.Root>
    </header>
  );
};

const positionerClassName =
  "box-border h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-[instant]:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5";

const popupClassName =
  "w-full rounded bg-(--color-surface) border border-(--color-border) data-[ending-style]:easing-[ease] relative h-[var(--popup-height)] origin-[var(--transform-origin)] transition-[opacity,transform,width,height,scale,translate] duration-[var(--duration)] ease-[var(--easing)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 min-[500px]:w-[var(--popup-width)] xs:w-[var(--popup-width)]";

const arrowClassName =
  "flex transition-[left] duration-[var(--duration)] ease-[var(--easing)] data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180";
