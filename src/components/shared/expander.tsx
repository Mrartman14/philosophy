import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";
import { Collapsible } from "@base-ui-components/react/collapsible";

type ExpanderProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
};
export const Expander: React.FC<ExpanderProps> = ({ children, trigger }) => {
  return (
    <Collapsible.Root className="flex w-full flex-col justify-center">
      <Collapsible.Trigger className="cursor-pointer group flex items-center gap-2 rounded-sm px-2 py-1 focus-visible:outline focus-visible:outline-blue-800">
        <ChevronDownIcon className="size-3 transition-all ease-out group-data-[panel-open]:rotate-90" />
        {trigger}
      </Collapsible.Trigger>
      <Collapsible.Panel className="flex h-[var(--collapsible-panel-height)] flex-col justify-end overflow-hidden transition-all ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};
