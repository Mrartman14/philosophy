import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { getLectures } from "@/features/lectures/api";
import { AppHeader } from "@/components/app/app-header/app-header";
import { InstallBanner } from "@/components/app/install-banner";
import { UpdatePrompt } from "@/components/app/update-prompt";
import { YandexMetrika } from "@/components/yandex-metrika/yandex-metrika";
import { getMe, type MaybeMe } from "@/utils/me";
import { StatusBanner } from "@/components/permission/status-banner";

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
  let lectures: Awaited<ReturnType<typeof getLectures>>["data"] = [];
  let me: MaybeMe = null;
  try {
    // Параллельно: getMe и getLectures независимы, нет смысла сериализовать.
    // Promise.allSettled, чтобы падение getLectures не уронило getMe и наоборот:
    // лекции опциональны для рендера, me — тоже.
    const [lecturesResult, meResult] = await Promise.allSettled([
      getLectures(0, 100),
      getMe(),
    ]);
    if (lecturesResult.status === "fulfilled") {
      lectures = lecturesResult.value.data;
    }
    if (meResult.status === "fulfilled") {
      me = meResult.value;
    }
    // Если getMe бросил (5xx) — me останется null. Это допустимая
    // деградация для root layout: header покажет «Войти», глобальный
    // StatusBanner ничего не нарисует.
  } catch {
    // unreachable: allSettled не бросает
  }

  return (
    <html lang="ru">
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
          root bg-(--color-background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[var(--header-height)_1fr] items-stretch justify-items-center min-h-screen
          ${geistClasses}
          `}
      >
        <AppHeader lectures={lectures} me={me} />
        <StatusBanner me={me} />
        <InstallBanner />
        <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-l md:border-r md:border-(--color-border)">
          {children}
        </main>
        <UpdatePrompt />
        <Suspense>
          <YandexMetrika />
        </Suspense>
      </body>
    </html>
  );
}
