"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeSelect from "./theme-select";

const links: { name: string; href: string }[] = [
  { name: "Home", href: "/" },
  { name: "Introduction", href: "/lections/introduction" },
  { name: "Experimental science", href: "/lections/experimental-science" },
  { name: "Ancient ethics", href: "/lections/ancient-ethics" },
  {
    name: "New european theory of knowledge",
    href: "/lections/new-european-theory-of-knowledge",
  },
];

export const AppHeader: React.FC = () => {
  const pathname = usePathname();

  return (
    <header className="grid gap-4 grid-cols-[1fr_auto]">
      <nav className="flex items-center gap-4">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`dark:text-indigo-400 text-lg
                ${isActive ? "underline underline-offset-4" : "no-underline"}`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>
      <ThemeSelect />
    </header>
  );
};
