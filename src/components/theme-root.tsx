import { useEffect } from "react";
import { applyTheme, readTheme } from "@/lib/theme";

export function ThemeRoot() {
  useEffect(() => {
    applyTheme(readTheme());
  }, []);
  return null;
}
