import type { Metadata } from "next";
import { Geist, Geist_Mono, Atkinson_Hyperlegible, Source_Serif_4 } from "next/font/google";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import "./globals.css";

import { AppHeader } from "@/components/app/app-header/app-header";
import { InstallBanner } from "@/components/app/install-banner";
import { UpdatePrompt } from "@/components/app/update-prompt";
import { AppearanceProvider } from "@/components/appearance";
import { htmlAttrs } from "@/components/appearance/appearance-cookie";
import { StatusBanner } from "@/components/permission/status-banner";
import { ToastProvider, Toaster } from "@/components/ui";
import { YandexMetrika } from "@/components/yandex-metrika/yandex-metrika";
import { ActiveBanners } from "@/features/banners";
import { getClientMessages, getLocale, getT } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { metadataBaseUrl } from "@/seo/site-url";
import { WebVitalsReporter } from "@/services/observability/web-vitals-reporter";
import { OfflineIdentityGuard } from "@/services/offline/offline-identity-guard";
import { getAppearance } from "@/utils/appearance";
import { getBanSignal, getMe, type MaybeMe } from "@/utils/me";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  const siteName = t("appTitle");
  return {
    metadataBase: metadataBaseUrl(),
    // title.template добавляет бренд к титулам страниц: "<page> — <siteName>".
    // default — для корня (home). Per-page возвращают просто строку.
    title: { default: siteName, template: `%s — ${siteName}` },
    description: t("appDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      title: t("appShortName"),
      capable: true,
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description: t("appDescription"),
      images: ["/logo.png"],
    },
    twitter: {
      // дефолтная картинка — логотип (не 1200×630) → summary, не large.
      card: "summary",
      title: siteName,
      description: t("appDescription"),
      images: ["/logo.png"],
    },
  };
}

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

  const appearance = await getAppearance();
  const locale = await getLocale();
  const messages = await getClientMessages();
  const { style, colorScheme, ...dataAttrs } = htmlAttrs(appearance);

  return (
    <html lang={locale} {...dataAttrs} style={{ ...style, colorScheme }}>
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
          root bg-(--color-surface)
          ${geistSans.variable} ${geistMono.variable} ${atkinson.variable} ${sourceSerif.variable} antialiased
          grid grid-rows-[var(--header-height)_1fr] items-stretch justify-items-center min-h-screen
          `}
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <I18nProvider locale={locale} messages={messages}>
          <AppearanceProvider initial={appearance}>
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
          </AppearanceProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
