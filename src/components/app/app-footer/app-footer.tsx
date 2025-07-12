import { AppFooterSlot } from "./app-footer-slot";

export const AppFooter: React.FC = () => {
  return (
    <footer
      className={`flex justify-center items-stretch border-t md:border-b border-(--border) w-full`}
    >
      <div
        id="app-footer"
        className={`w-full max-w-[100vw] lg:max-w-screen-lg md:border-l md:border-r border-(--border) bg-(--background) p-4`}
      >
        <AppFooterSlot />
      </div>
    </footer>
  );
};
