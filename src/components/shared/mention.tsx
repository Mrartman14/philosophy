import { Popup } from "./popup/popup";
import { MentionInfo } from "./mention-info";
import { philosophers } from "@/utils/philosophers";

type MentionProps = {
  className?: string;
  name: string;
  style?: React.CSSProperties;
  withPopover?: boolean;
};
export const Mention: React.FC<MentionProps> = ({
  name,
  style,
  className,
  withPopover = false,
}) => {
  const textNode = (
    <span className={`${className ?? ""}`} style={style}>
      {name}
    </span>
  );

  if (!withPopover) {
    return textNode;
  }

  const philosopher = philosophers.find((x) => x.name === name);
  if (!philosopher) return textNode;

  return (
    <Popup trigger={textNode} content={<MentionInfo data={philosopher} />} />
  );
};
