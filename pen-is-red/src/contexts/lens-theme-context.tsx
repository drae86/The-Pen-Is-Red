import { createContext, useContext, useState, useCallback } from "react";
import { applyLensTheme } from "@/lib/lens-theme";

interface LensThemeContextType {
  activeLens: string;
  setActiveLens: (lens: string) => void;
}

const LensThemeContext = createContext<LensThemeContextType>({
  activeLens: "red_team",
  setActiveLens: () => {},
});

export function LensThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeLens, setActiveLensState] = useState("red_team");

  const setActiveLens = useCallback((lens: string) => {
    if (!lens) return;
    setActiveLensState(lens);
    applyLensTheme(lens);
  }, []);

  return (
    <LensThemeContext.Provider value={{ activeLens, setActiveLens }}>
      {children}
    </LensThemeContext.Provider>
  );
}

export function useLensTheme() {
  return useContext(LensThemeContext);
}
