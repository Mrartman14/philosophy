import { Slider } from "@base-ui-components/react";

type WidthSliderProps = {
  value: number;
  onChange: (next: number) => void;
  className?: string;
};
export const WidthSlider: React.FC<WidthSliderProps> = ({
  onChange,
  value,
  className,
}) => (
  <Slider.Root
    value={value}
    min={1}
    max={20}
    onValueChange={onChange}
    className={className}
  >
    <Slider.Control className="flex w-20 touch-none items-center py-3 select-none">
      <Slider.Track className="h-2 w-full rounded bg-(--border) select-none">
        <Slider.Indicator className="rounded bg-gray-700 select-none" />
        <Slider.Thumb className="cursor-pointer size-3 rounded-full bg-(--link) select-none focus-visible:outline focus-visible:outline-blue-800" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
);
