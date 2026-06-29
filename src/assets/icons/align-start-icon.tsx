import { SVGProps } from "react";

/**
 * Выравнивание по началу строки (ragged): строки прижаты к началу, правый край
 * рваный (разная длина). Логический смысл «start»; зеркалить под RTL намеренно НЕ
 * пытаемся — в проекте иконки не отражаются, семантику несёт sr-only метка.
 */
export const AlignStartIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <line x1="4" x2="20" y1="6" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" x2="13" y1="10" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" x2="18" y1="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" x2="12" y1="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
