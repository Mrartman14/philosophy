import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Theme from "./_providers/theme";
import { AppHeader } from "@/components/app/app-header";
import { SWProvider } from "@/components/shared/sw-provider";

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
          grid grid-rows-[auto_1fr] items-center justify-items-center min-h-screen
          ${finalClasses}
          `}
      >
        <SWProvider />
        <Theme>
          <AppHeader />
          <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            {children}
          </main>
          <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center"></footer>
        </Theme>
      </body>
    </html>
  );
}
