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

  const size = radius * 2;
  const size2 = (radius * 2) / (scale / 1.5);
  return (
    <foreignObject
      x={x - radius}
      y={y - radius}
      width={size}
      height={size}
      style={{ overflow: "visible", position: "relative" }}
    >
      <Popover.Root openOnHover>
        <Popover.Trigger
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            style={{
              width: size2,
              height: size2,
              borderRadius: "50%",
              backgroundSize: "cover",
              backgroundImage: `url(${basePath}${philosopher.imageSrc})`,
              outline: "2px solid var(--link)",
            }}
          />
          {/* <div
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
                outline: "1px solid var(--link)",
              }}
            />
          </div> */}
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
