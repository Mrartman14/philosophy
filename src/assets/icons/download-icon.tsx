import { SVGProps } from "react";

/** Стрелка вниз в лоток — экспорт/скачивание. */
export const DownloadIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M12 3v11" />
    <path d="M8 10l4 4 4-4" />
    <path d="M5 19h14" />
  </svg>
);
