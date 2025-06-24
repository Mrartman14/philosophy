type MentionProps = React.PropsWithChildren<{ className?: string }>;
export const Mention: React.FC<MentionProps> = ({ children, className }) => (
  <p className={`text-(--description) ${className}`}>{children}</p>
);
