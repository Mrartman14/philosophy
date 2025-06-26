import Image from "next/image";
import { Popover } from "@base-ui-components/react/popover";

import type { Timeline } from "./timeline";
import { DropdownArrowIcon } from "@/assets/icons/arrow-icon";

type PhilosopherViewProps = {
  x: number;
  y: number;
  philosopher: Timeline;
  scale: number;
};
export const PhilosopherView: React.FC<PhilosopherViewProps> = ({
  x,
  y,
  scale,
  philosopher,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const radius = 10;
  const scaledSize = (radius * 2) / (scale / 1.5);

  return (
    <foreignObject
      x={x - scaledSize / 2}
      y={y - scaledSize / 2}
      width={scaledSize}
      height={scaledSize}
      style={{ overflow: "visible" }}
    >
      <Popover.Root openOnHover>
        <Popover.Trigger style={{ aspectRatio: "1 / 1" }}>
          <div
            style={{
              width: scaledSize,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
            }}
          >
            <Image
              fill
              src={`${basePath}${philosopher.imageSrc}`}
              alt={`${philosopher.name} image`}
              style={{
                objectFit: "cover",
                borderRadius: "50%",
                margin: 0,
              }}
            />
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8}>
            <Popover.Popup className="bg-(--background) rounded-lg px-6 py-4 outline outline-(--border) origin-[var(--transform-origin)] transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
              <Popover.Arrow className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180">
                <DropdownArrowIcon />
              </Popover.Arrow>
              <Image
                src={`${basePath}${philosopher.imageSrc}`}
                alt={`${philosopher.name} image`}
                width={100}
                height={50}
                style={{
                  margin: 0,
                }}
              />
              <h1 className="text-lg">{philosopher.name}</h1>
              <p>
                Годы жизни: {philosopher.from} — {philosopher.to}
              </p>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </foreignObject>
  );
};
