import { getLectures } from "@/api/lecture-api";
import { AppPageClientProvider } from "./app-page-client-provider";

export const AppPageProvider: React.FC<React.PropsWithChildren> = async ({
  children,
}) => {
  const result = await getLectures(1, 100);

  return (
    <AppPageClientProvider lectures={result.data ?? []}>
      {children}
    </AppPageClientProvider>
  );
};
