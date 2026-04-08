"use client";

import { createContext, useContext } from "react";
import type { components } from "@/api/schema";

type Lecture = components["schemas"]["lecture.Lecture"];

type AppContext = {
  lectures: Lecture[];
};

const AppPageContext = createContext<AppContext>({ lectures: [] });

export const AppPageClientProvider: React.FC<
  React.PropsWithChildren<{ lectures: Lecture[] }>
> = ({ children, lectures }) => {
  return <AppPageContext value={{ lectures }}>{children}</AppPageContext>;
};

export const useAppPageConfig = () => useContext(AppPageContext);
