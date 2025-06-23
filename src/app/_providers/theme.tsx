// app/providers/ThemeProvider.tsx
"use client";
import { ThemeProvider } from "next-themes";

const Theme: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      {children}
    </ThemeProvider>
  );
};
export default Theme;
