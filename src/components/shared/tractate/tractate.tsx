import { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import "./tractate.css";

const baseClassName =
  "prose prose-slate dark:prose-invert md:prose-xl max-w-full prose-p:text-justify prose-a:text-primary";

type TractateProps<T extends ElementType = "div"> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Tractate<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: TractateProps<T>) {
  const Tag = as || "div";
  const combinedClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  return (
    <Tag className={combinedClassName} {...rest}>
      {children}
    </Tag>
  );
}
