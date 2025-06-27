// import { DropdownArrowIcon } from "@/assets/icons/arrow-icon";
import { Slider } from "@base-ui-components/react/slider";
// import { Tooltip } from "@base-ui-components/react/tooltip";

type WidthSliderProps = {
  value: number;
  onChange: (next: number) => void;
  className?: string;
};
export const WidthSlider: React.FC<WidthSliderProps> = ({
  onChange,
  value,
  className,
}) => (
  // <Tooltip.Root>
  //   <Tooltip.Trigger className="flex size-8 items-center justify-center rounded-sm text-gray-900 select-none hover:bg-gray-100 focus-visible:bg-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-gray-200 data-[popup-open]:bg-gray-100 focus-visible:[&:not(:hover)]:bg-transparent">
  <Slider.Root
    value={value}
    min={1}
    max={20}
    onValueChange={onChange}
    className={className}
  >
    <Slider.Control className="flex w-20 touch-none items-center py-3 select-none">
      <Slider.Track className="h-2 w-full rounded bg-(--border) select-none">
        <Slider.Indicator className="rounded bg-gray-700 select-none" />
        <Slider.Thumb className="cursor-pointer size-3 rounded-full bg-(--link) select-none focus-visible:outline focus-visible:outline-blue-800" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
  //   </Tooltip.Trigger>
  //   <Tooltip.Portal>
  //     <Tooltip.Positioner sideOffset={10}>
  //       <Tooltip.Popup className="flex origin-[var(--transform-origin)] flex-col rounded-md bg-[canvas] px-2 py-1 text-sm shadow-lg shadow-gray-200 outline outline-1 outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300">
  //         <Tooltip.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
  //           <DropdownArrowIcon />
  //         </Tooltip.Arrow>
  //         Underline
  //       </Tooltip.Popup>
  //     </Tooltip.Positioner>
  //   </Tooltip.Portal>
  // </Tooltip.Root>
);
