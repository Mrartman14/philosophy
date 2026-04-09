import { Slider } from "@base-ui/react/slider";
import { Popover } from "@base-ui/react/popover";
import { VolumeIcon } from "@/assets/icons/volume-icon";
import { VolumeMutedIcon } from "@/assets/icons/volume-muted-icon";

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
}

const VolumeSlider: React.FC<Pick<VolumeControlProps, "volume" | "muted" | "onChangeVolume">> = ({
  volume,
  muted,
  onChangeVolume,
}) => (
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
);

const VolumeButton: React.FC<Pick<VolumeControlProps, "volume" | "muted" | "onToggleMute">> = ({
  volume,
  muted,
  onToggleMute,
}) => (
  <button
    onClick={onToggleMute}
    className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
    aria-label={muted ? "Включить звук" : "Выключить звук"}
  >
    {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeIcon />}
  </button>
);

export const VolumeControl: React.FC<VolumeControlProps> = (props) => {
  return (
    <>
      {/* Desktop: inline button + slider */}
      <div className="hidden md:flex items-center gap-1">
        <VolumeButton volume={props.volume} muted={props.muted} onToggleMute={props.onToggleMute} />
        <VolumeSlider volume={props.volume} muted={props.muted} onChangeVolume={props.onChangeVolume} />
      </div>

      {/* Mobile: button opens popover with slider */}
      <div className="flex md:hidden">
        <Popover.Root>
          <Popover.Trigger
            className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
            aria-label={props.muted ? "Громкость (выключен)" : "Громкость"}
          >
            {props.muted || props.volume === 0 ? <VolumeMutedIcon /> : <VolumeIcon />}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8}>
              <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg">
                <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
                <div className="flex items-center gap-2">
                  <VolumeButton volume={props.volume} muted={props.muted} onToggleMute={props.onToggleMute} />
                  <VolumeSlider volume={props.volume} muted={props.muted} onChangeVolume={props.onChangeVolume} />
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </>
  );
};
