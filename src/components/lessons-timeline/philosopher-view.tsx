import Image from "next/image";

import { Popup } from "../shared/popup/popup";
import type { Timeline } from "@/utils/philosophers";
import { MentionInfo } from "../shared/mention-info";

type PhilosopherViewProps = {
  x: number;
  y: number;
  philosopher: Timeline;
  scale: number;
};
export const PhilosopherView: React.FC<PhilosopherViewProps> = ({
  x,
  y,
  // scale,
  philosopher,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const radius = 10;

  const size = radius * 2;
  // const size2 = (radius * 2) / (scale / 1.5);
  return (
    <foreignObject
      x={x - radius}
      y={y - radius}
      width={size}
      height={size}
      style={{ overflow: "visible", position: "relative" }}
    >
      <Popup
        triggerProps={{
          className: "cursor-pointer",
          style: {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          },
        }}
        trigger={
          <div
            style={{
              width: size,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
            }}
          >
            {/* <div
            style={{
              width: size2,
              height: size2,
              borderRadius: "50%",
              backgroundSize: "cover",
              backgroundImage: `url(${basePath}${philosopher.imageSrc})`,
              outline: "2px solid var(--link)",
            }}
          /> */}
            <Image
              fill
              src={`${basePath}${philosopher.imageSrc}`}
              alt={`${philosopher.name} image`}
              quality={1}
              sizes="100px"
              style={{
                objectFit: "cover",
                borderRadius: "50%",
                margin: 0,
                outline: "1px solid var(--link)",
              }}
            />
          </div>
        }
        content={<MentionInfo data={philosopher} />}
      />
    </foreignObject>
  );
};
