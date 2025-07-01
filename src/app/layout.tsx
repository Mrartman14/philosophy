import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppHeader } from "@/components/app/app-header";
import Theme from "./_providers/theme";

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

export const metadata: Metadata = {
  title: "Philosophy",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          root bg-(--background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[auto_1fr_20px] items-center justify-items-center min-h-screen
          ${finalClasses}
          `}
      >
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
// TODO: collapsible theses
