"use client";
import { useEffect, useState } from "react";

type AppTheme = "system" | "light" | "dark";

const themes: { value: AppTheme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyTheme(theme: AppTheme) {
  if (theme === "system") {
    const isSystemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.documentElement.classList.toggle("dark", isSystemDark);
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export default function ThemeSelect() {
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as AppTheme) || "system";
    setTheme(saved);
    applyTheme(saved);

    if (saved === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, []);

  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const value = e.target.value as AppTheme;
    setTheme(value);
    localStorage.setItem("theme", value);
    applyTheme(value);
  };

  return (
    <select
      value={theme}
      onChange={handleChange}
      className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
      aria-label="App theme select"
    >
      {themes.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
