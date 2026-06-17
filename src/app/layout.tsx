import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import "./globals.css";

import { AppHeader } from "@/components/app/app-header/app-header";
import { InstallBanner } from "@/components/app/install-banner";
import { UpdatePrompt } from "@/components/app/update-prompt";
import { StatusBanner } from "@/components/permission/status-banner";
import { ToastProvider, Toaster } from "@/components/ui";
import { YandexMetrika } from "@/components/yandex-metrika/yandex-metrika";
import { ActiveBanners } from "@/features/banners";
import { WebVitalsReporter } from "@/services/observability/web-vitals-reporter";
import { OfflineIdentityGuard } from "@/services/offline/offline-identity-guard";
import { getBanSignal, getMe, type MaybeMe } from "@/utils/me";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const geistClasses = "font-[family-name:var(--font-geist-sans)]";

export const metadata: Metadata = {
  title: "Философия-ликбез",
  description: "Архив занятий курса Философия-ликбез",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "ФЛБЗ",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let me: MaybeMe = null;
  let banned = false;
  try {
    me = await getMe();
    banned = await getBanSignal();
  } catch {
    // допустимая деградация: header покажет «Войти», StatusBanner ничего не нарисует
  }
  // Бан ловим вне try: redirect() бросает NEXT_REDIRECT, его нельзя глотать.
  if (banned) redirect("/auth/forced-logout");

  return (
    <html lang="ru">
      <head>
        <meta
          name="theme-color"
          content="#f6f2eb"
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
          root bg-(--color-background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[var(--header-height)_1fr] items-stretch justify-items-center min-h-screen
          ${geistClasses}
          `}
      >
        <ToastProvider>
          <OfflineIdentityGuard userId={me?.id ?? null} />
          <AppHeader />
          <StatusBanner me={me} />
          <ActiveBanners />
          <InstallBanner />
          <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-l md:border-r md:border-(--color-border)">
            {children}
          </main>
          <WebVitalsReporter />
          <UpdatePrompt />
          <Suspense>
            <YandexMetrika />
          </Suspense>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
