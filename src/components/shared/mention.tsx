type MentionProps = React.PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
}>;
export const Mention: React.FC<MentionProps> = ({
  children,
  style,
  className,
}) => (
  <span className={`text-(--description) ${className}`} style={style}>
    {children}
  </span>
);
