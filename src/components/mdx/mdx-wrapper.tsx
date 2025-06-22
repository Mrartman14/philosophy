import { MDXComponents } from "mdx/types";

export const MDXWrapper: React.FC<MDXComponents["wrapper"]> = ({
  params,
  searchParams,
  children,
}) => {
  //   console.log(params, searchParams);

  return (
    <article className="prose dark:prose-invert lg:prose-xl">
      {children}
    </article>
  );
};
