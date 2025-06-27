import { DropdownArrowIcon } from "@/assets/icons/arrow-icon";
import { Popover } from "@base-ui-components/react/popover";

type PopupProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  triggerProps?: React.ComponentProps<typeof Popover.Trigger>;
};
export const Popup: React.FC<PopupProps> = ({ content, trigger }) => {
  return (
    <Popover.Root openOnHover>
      <Popover.Trigger>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="bg-(--background) rounded-lg px-6 py-4 outline outline-(--border) origin-[var(--transform-origin)] transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <Popover.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
              <DropdownArrowIcon />
            </Popover.Arrow>
            {content}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
