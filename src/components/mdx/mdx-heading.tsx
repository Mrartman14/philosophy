"use client";

import { createElement } from "react";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type MdxHeadingProps = React.PropsWithChildren<{
  level: HeadingLevel;
}>;
export const MdxHeading: React.FC<MdxHeadingProps> = ({
  level,
  children,
  ...rest
}) => {
  const isAnchorHeading = level !== "h1" && typeof children === "string";
  const id = isAnchorHeading ? children.replaceAll(" ", "-") : undefined;

  return createElement(
    level,
    {
      ...rest,
      id,
      "data-heading-id": isAnchorHeading ? id : undefined,
      "data-title-id": isAnchorHeading ? children : undefined,
    },
    children
  );
};
