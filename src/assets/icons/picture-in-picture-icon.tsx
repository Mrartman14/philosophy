// Picture-in-Picture: внешний экран + малый экран в нижнем-правом углу.
export function PictureInPictureIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...props}>
      <path
        d="M3 5h18v14H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="12" y="11" width="7" height="5" fill="currentColor" />
    </svg>
  );
}
