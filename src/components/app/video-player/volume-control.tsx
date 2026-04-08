import { Slider } from "@base-ui/react/slider";
import { VolumeIcon } from "@/assets/icons/volume-icon";
import { VolumeMutedIcon } from "@/assets/icons/volume-muted-icon";

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
}) => {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleMute}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label={muted ? "Включить звук" : "Выключить звук"}
      >
        {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeIcon />}
      </button>
      <Slider.Root
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onValueChange={(value) => onChangeVolume(value)}
        className="relative flex items-center w-16 cursor-pointer touch-none"
        aria-label="Громкость"
      >
        <Slider.Control className="relative flex items-center w-full h-6">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border)">
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-2.5 h-2.5 rounded-full bg-(--color-primary) shadow focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
};
