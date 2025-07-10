import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Theme from "./_providers/theme";
import { SWProvider } from "@/app/_providers/sw-provider";
import { AppPageProvider } from "./_providers/app-page-provider";
import { AppHeader } from "@/components/app/app-header/app-header";
import { AppFooter } from "@/components/app/app-footer/app-footer";
import { NewLessonsProvider } from "./_providers/new-lessons-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const geistClasses = "font-[family-name:var(--font-geist-sans)]";
const finalClasses = geistClasses;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const metadata: Metadata = {
  title: "Философия-ликбез",
  description: "Архив занятий курса Философия-ликбез",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    title: "ФЛБЗ",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta
          name="theme-color"
          content="#f8f8f8"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#111a20"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body
        className={`
          root bg-(--background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[var(--header-height)_minmax(calc(100vh_-_var(--header-height)),_1fr)_auto] items-stretch justify-items-center min-h-screen
          ${finalClasses}
          `}
      >
        <SWProvider />
        <NewLessonsProvider />
        <Theme>
          <AppPageProvider>
            <AppHeader />
            <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-l md:border-r md:border-(--border)">
              {children}
            </main>
            <AppFooter />
          </AppPageProvider>
        </Theme>
      </body>
    </html>
  );
}
