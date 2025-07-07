"use client";

import { createContext, useContext } from "react";

import { PageConfig } from "@/entities/page-data";

const AppPageContext = createContext<PageConfig>({ exams: [], lectures: [] });
export const AppPageClientProvider: React.FC<
  React.PropsWithChildren<{ pageConfig: PageConfig }>
> = ({ children, pageConfig }) => {
  return <AppPageContext value={pageConfig}>{children}</AppPageContext>;
};

export const useAppPageConfig = () => useContext(AppPageContext);
