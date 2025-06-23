import { useState } from "react";
import Link from "next/link";

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
      className="flex flex-col justify-center items-center rounded-2xl no-underline transition bg-none hover:bg-cover hover:bg-center"
      style={{
        pointerEvents: href ? "auto" : "none",
        filter: href ? "none" : "grayscale(80%)",
        backgroundImage: hover ? `url(${imageSrc})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className={`text-4xl font-bold ${hover ? "text-black" : ""}`}>
        {title}
      </span>
      <span
        className={`text-lg text-(--description) ${hover ? "text-black" : ""}`}
      >
        {description}
      </span>
    </Link>
  );
};
