import { SVGProps } from "react";

/** Г-образная линейка с засечками — тогл координатных линеек. */
export const RulerIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M4 4v16h16" />
    <path d="M9 20v-3M14 20v-4M19 20v-3" />
    <path d="M4 9h3M4 14h4M4 19h3" />
  </svg>
);
