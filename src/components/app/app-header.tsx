"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeSelect from "./theme-select";
import { structure } from "@/structure";

export const AppHeader: React.FC = () => {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 w-full pl-4 pr-4 grid gap-4 grid-cols-[1fr_auto] bg-(--background) border-b border-(--border)"
      style={{ height: "var(--header-height)" }}
    >
      <nav className="flex items-center gap-4">
        {structure.map((link) => {
          const href = `/lectures/${link.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`
                text-xl
                ${isActive ? "underline underline-offset-4" : "no-underline"}`}
            >
              {link.title}
            </Link>
          );
        })}
      </nav>
      <ThemeSelect />
    </header>
  );
};
