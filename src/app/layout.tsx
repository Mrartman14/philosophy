import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body
        className={`
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]
          `}
      >
        <header className="grid">
          <nav className="flex items-center gap-4">
            <Link href={"/"}>Home</Link>
            <Link href={"/lections/introduction"}>introduction</Link>
            <Link href={"/lections/experimental-science"}>
              Experimental science
            </Link>
            <Link href={"/lections/ethics"}>Ethics</Link>
            <Link href={"/lections/new-european-theory-of-knowledge"}>
              New european theory of knowledge
            </Link>
          </nav>
        </header>
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          {children}
        </main>
        <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
          footer
        </footer>
      </body>
    </html>
  );
}
