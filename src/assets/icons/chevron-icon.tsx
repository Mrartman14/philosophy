// Горизонтальный шеврон. По умолчанию указывает в сторону чтения (inline-end,
// т.е. «вправо» в LTR). Для «назад»/prev — повернуть на 180° (`rotate-180`);
// для RTL направленность зеркалит класс `.rtl-flip` (см. globals.css).
export function ChevronIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...props}>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
