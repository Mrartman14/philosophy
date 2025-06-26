import type { Timeline } from "./timeline";

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
    <g>
      {/* Клиппинг путь для круга */}
      <defs>
        <clipPath id={clipId}>
          <circle cx={x} cy={y} r={radius} />
        </clipPath>
      </defs>
      {/* Аватар внутри круга */}
      <image
        href={philosopher.imageSrc}
        x={x - radius}
        y={y - radius}
        width={radius * 2}
        height={radius * 2}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
      />
      {/* Белая обводка круга */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="none"
        stroke="#fff"
        strokeWidth={1}
      />
      {/* Имя философа */}
      <text
        x={x}
        y={y + radius + 16}
        textAnchor="middle"
        fontSize={14}
        fill="#222"
      >
        {philosopher.name}
      </text>
    </g>
  );
};
