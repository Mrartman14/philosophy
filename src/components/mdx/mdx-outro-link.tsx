import { useState } from "react";
import Link from "next/link";

type MDXOutroLinkProps = {
  href: string;
  title: string;
  description: string;
  imageSrc: string;
};
export const MDXOutroLink: React.FC<MDXOutroLinkProps> = ({
  description,
  href,
  imageSrc,
  title,
}) => {
  const [hover, setHover] = useState(false);

  return (
    <Link
      key={title}
      href={href}
      className="flex flex-col justify-center items-center rounded-2xl no-underline transition bg-none hover:bg-cover hover:bg-center"
      style={{
        backgroundImage: hover ? `url(${imageSrc})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className={`transition-all mix-blend-difference ${
          hover ? "text-lg" : "text-2xl"
        }`}
      >
        {title}
      </span>
      <span
        className={`transition-all mix-blend-difference ${
          hover ? "text-xs" : "text-lg"
        }`}
      >
        {description}
      </span>
    </Link>
  );
};
