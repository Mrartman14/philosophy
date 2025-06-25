type MentionProps = React.PropsWithChildren<{ className?: string }>;
export const Mention: React.FC<MentionProps> = ({ children, className }) => (
  <span className={`text-(--description) ${className}`}>{children}</span>
);
