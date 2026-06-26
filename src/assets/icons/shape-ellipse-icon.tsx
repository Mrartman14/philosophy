import { SVGProps } from "react";

/** Эллипс — добавить фигуру ellipse. */
export const ShapeEllipseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <ellipse cx="12" cy="12" rx="8" ry="6" stroke="currentColor" strokeWidth="2" />
  </svg>
);
