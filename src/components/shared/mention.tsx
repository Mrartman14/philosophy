// import Image from "next/image";
// import { philosophers } from "@/utils/philosophers";

type MentionProps = {
  className?: string;
  name: string;
  style?: React.CSSProperties;
  withPopover?: boolean;
};
export const Mention: React.FC<MentionProps> = ({
  name,
  style,
  className,
  // withPopover = false,
}) => {
  // const imageSrc = philosophers.find((x) => x.name === name)?.imageSrc;
  // const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <span className={`text-(--description) ${className}`} style={style}>
      {/* {imageSrc && (
        <Image
          src={`${basePath}${imageSrc}`}
          alt={`${name} image`}
          quality={1}
          sizes="100px"
          width={25}
          height={25}
        />
      )} */}
      {name}
    </span>
  );
};
