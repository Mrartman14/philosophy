import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type DocxOutroLinkProps = {
  href?: string;
  title?: string;
  description?: string;
  imageSrc?: string;
};
export const DocxOutroLink: React.FC<DocxOutroLinkProps> = ({
  description,
  href,
  imageSrc,
  title,
}) => {
  const [hover, setHover] = useState(false);

  return (
    <Link
      key={title}
      href={href ?? ""}
      className={`overflow-hidden relative rounded-2xl border border-(--border) no-underline transition`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {imageSrc && (
        <Image
          fill
          alt={`${title} image`}
          className={`absolute hidden md:block w-full h-full object-cover transition-transform duration-500`}
          src={imageSrc}
          style={{
            margin: 0,
            transform: hover ? "scale(1.2)" : undefined,
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
          }}
        />
      )}
      <div
        className={`w-full absolute grid p-1 ${
          hover ? "rounded-2md bg-(--text-pane)" : ""
        }`}
        style={{
          transform: "translate(-50%, -50%)",
          top: "50%",
          left: "50%",
          justifyItems: "center",
        }}
      >
        <span className={`text-xl md:text-4xl font-bold`}>{title}</span>
        <span
          className={`text-sm md:text-lg text-(--description)`}
          style={{ textAlign: "center" }}
        >
          {description}
        </span>
      </div>
    </Link>
  );
};
