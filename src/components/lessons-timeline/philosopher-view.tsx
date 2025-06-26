import { Popover } from "@base-ui-components/react/popover";
import type { Timeline } from "./timeline";
import { DropdownArrowIcon } from "@/assets/icons/arrow-icon";

type PhilosopherViewProps = {
  x: number;
  y: number;
  philosopher: Timeline;
};
export const PhilosopherView: React.FC<PhilosopherViewProps> = ({
  x,
  y,
  philosopher,
}) => {
  const radius = 8;
  const clipId = `clip-${philosopher.name.replace(/\s/g, "-")}`;

  return (
    <Popover.Root>
      <Popover.Trigger
        // className="flex size-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-900 select-none hover:bg-gray-100 focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-gray-100 data-[popup-open]:bg-gray-100"
        render={() => (
          <foreignObject
            x={x - radius}
            y={y - radius}
            width={radius * 2}
            height={radius * 2}
            style={{ overflow: "visible" }}
          >
            <button
              style={{
                width: radius * 2,
                height: radius * 2,
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
              tabIndex={0}
              aria-label={philosopher.name}
            >
              <svg width={radius * 2} height={radius * 2}>
                <defs>
                  <clipPath id={clipId}>
                    <circle cx={radius} cy={radius} r={radius} />
                  </clipPath>
                </defs>
                <image
                  href={philosopher.imageSrc}
                  x={0}
                  y={0}
                  width={radius * 2}
                  height={radius * 2}
                  clipPath={`url(#${clipId})`}
                  preserveAspectRatio="xMidYMid slice"
                />
                <circle
                  cx={radius}
                  cy={radius}
                  r={radius}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                />
              </svg>
            </button>
          </foreignObject>
          //   <g className="cursor-pointer" role="button">
          //     {/* Клиппинг путь для круга */}
          //     <defs>
          //       <clipPath id={clipId}>
          //         <circle cx={x} cy={y} r={radius} />
          //       </clipPath>
          //     </defs>
          //     {/* Аватар внутри круга */}
          //     <image
          //       href={philosopher.imageSrc}
          //       x={x - radius}
          //       y={y - radius}
          //       width={radius * 2}
          //       height={radius * 2}
          //       clipPath={`url(#${clipId})`}
          //       preserveAspectRatio="xMidYMid slice"
          //     />
          //     {/* Белая обводка круга */}
          //     <circle
          //       cx={x}
          //       cy={y}
          //       r={radius}
          //       fill="none"
          //       stroke="var(--border)"
          //       strokeWidth={1}
          //     />
          //     {/* Имя философа */}
          //     <text x={x} y={y + radius + 16} textAnchor="middle" fontSize={14}>
          //       {philosopher.name}
          //     </text>
          //   </g>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="origin-[var(--transform-origin)] rounded-lg bg-[canvas] px-6 py-4 text-gray-900 shadow-lg shadow-gray-200 outline outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300">
            {/* <div style={{ width: 100, height: 100, background: "red" }} /> */}
            <Popover.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
              <DropdownArrowIcon />
            </Popover.Arrow>
            <Popover.Title className="text-base font-medium">
              Notifications
            </Popover.Title>
            <Popover.Description className="text-base">
              You are all caught up. Good job!
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

const PhilosopherPopover: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  return (
    <Popover.Root>
      <Popover.Trigger
        // className="flex size-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-900 select-none hover:bg-gray-100 focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-gray-100 data-[popup-open]:bg-gray-100"
        render={() => children}
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="origin-[var(--transform-origin)] rounded-lg bg-[canvas] px-6 py-4 text-gray-900 shadow-lg shadow-gray-200 outline outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300">
            {/* <div style={{ width: 100, height: 100, background: "red" }} /> */}
            <Popover.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
              <DropdownArrowIcon />
            </Popover.Arrow>
            <Popover.Title className="text-base font-medium">
              Notifications
            </Popover.Title>
            <Popover.Description className="text-base">
              You are all caught up. Good job!
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
