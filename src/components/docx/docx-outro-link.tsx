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
  return (
    <Link
      key={title}
      href={href ?? ""}
      className={`group overflow-hidden relative rounded-2xl border border-(--border) no-underline transition`}
    >
      {imageSrc && (
        <Image
          fill
          alt={`${title} image`}
          src={imageSrc}
          className="absolute hidden w-full h-full object-cover transition-transform duration-500 opacity-0 scale-100 group-hover:scale-120 group-hover:opacity-100 md:block"
          style={{
            margin: 0,
          }}
        />
      )}
      <div className="absolute top-1/2 left-1/2 w-full p-1 grid justify-items-center transform -translate-x-1/2 -translate-y-1/2 group-hover:bg-(--text-pane)">
        <span className="text-xl md:text-4xl font-bold">{title}</span>
        <span className="text-sm md:text-lg text-(--description) text-center">
          {description}
        </span>
      </div>
    </Link>
  );
};
