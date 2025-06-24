import { useTheme } from "next-themes";

export const ThemeSelect: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return null;
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
      aria-label="App theme select"
    >
      {["dark", "light", "system"].map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
};
