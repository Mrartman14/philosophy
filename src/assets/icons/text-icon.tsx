import { SVGProps } from "react";

/** Буква «T» — добавить текстовый узел. */
export const TextIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M5 6h14" />
    <path d="M12 6v12" />
  </svg>
);
