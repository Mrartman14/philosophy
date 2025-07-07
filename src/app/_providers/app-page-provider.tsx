import { getPageConfig } from "@/api/pages-api";
import { AppPageClientProvider } from "./app-page-client-provider";

export const AppPageProvider: React.FC<React.PropsWithChildren> = async ({
  children,
}) => {
  const pageConfig = await getPageConfig();

  return (
    <AppPageClientProvider pageConfig={pageConfig}>
      {children}
    </AppPageClientProvider>
  );
};
