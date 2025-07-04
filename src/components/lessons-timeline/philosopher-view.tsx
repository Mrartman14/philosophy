// import Image from "next/image";

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
  const radius = 15;

  const size = radius * 2;
  // const size2 = (radius * 2) / (scale / 1.5);
  return (
    <foreignObject x={x - radius} y={y - radius} width={size} height={size}>
      <Popup
        trigger={
          <div
            style={{
              width: size,
              height: size,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              backgroundImage: `url(${basePath}${philosopher.imageSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              cursor: "pointer",
            }}
          />
          // <div
          //   style={{
          //     width: size,
          //     height: size,
          //     aspectRatio: "1 / 1",
          //     borderRadius: "50%",
          //   }}
          // >
          //   <Image
          //     fill
          //     src={`${basePath}${philosopher.imageSrc}`}
          //     alt={`${philosopher.name} image`}
          //     quality={1}
          //     sizes={`${size}px`}
          //     className="cursor-pointer"
          //     style={{
          //       objectFit: "cover",
          //       borderRadius: "50%",
          //       margin: 0,
          //     }}
          //   />
          // </div>
        }
        content={<MentionInfo data={philosopher} />}
      />
    </foreignObject>
  );
};
