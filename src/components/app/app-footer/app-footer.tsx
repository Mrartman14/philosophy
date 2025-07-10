export const AppFooter: React.FC = () => {
  return (
    <footer
      className={`flex justify-center items-stretch border-t md:border-b border-(--border) h-10 w-full`}
    >
      <div
        className={`w-full max-w-[100vw] lg:max-w-screen-lg md:border-l md:border-r border-(--border) bg-(--background) pl-4 pr-4`}
      ></div>
    </footer>
  );
};
