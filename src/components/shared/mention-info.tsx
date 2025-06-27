import Image from "next/image";

import { Timeline } from "@/utils/philosophers";

const yearFormat = (year: number) =>
  year < 0 ? `${Math.abs(year)} г. до н.э.` : `${year} г.`;

type MentionInfoProps = { data: Timeline };
export const MentionInfo: React.FC<MentionInfoProps> = ({ data }) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <>
      <Image
        src={`${basePath}${data.imageSrc}`}
        alt={`${data.name} image`}
        width={100}
        height={50}
        style={{
          margin: 0,
        }}
      />
      <h1 className="text-lg">{data.name}</h1>
      <p>
        {yearFormat(data.from)} — {yearFormat(data.to)}
      </p>
    </>
  );
};
