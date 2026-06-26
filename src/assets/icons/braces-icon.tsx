import { SVGProps } from "react";

/** Фигурные скобки `{ }` — переключатель сырого JSON. */
export const BracesIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M8 4c-1.5 0-2 .8-2 2v3c0 1-.7 2-2 2 1.3 0 2 1 2 2v3c0 1.2.5 2 2 2" />
    <path d="M16 4c1.5 0 2 .8 2 2v3c0 1 .7 2 2 2-1.3 0-2 1-2 2v3c0 1.2-.5 2-2 2" />
  </svg>
);
