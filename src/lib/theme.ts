import { useEffect, useState } from "react";

const KEY = "ventran-theme";

export type Theme = "light" | "dark";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function useTheme(): { theme: Theme; toggle: () => void; ready: boolean } {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const next = readTheme();
    setTheme(next);
    applyTheme(next);
    setReady(true);
  }, []);
  return {
    theme,
    ready,
    toggle: () => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      setTheme(next);
      applyTheme(next);
    },
  };
}
