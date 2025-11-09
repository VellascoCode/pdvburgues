import React, { createContext, useContext, useMemo, useState } from 'react';

export type ThemeName = 'dark' | 'light' | 'code';

type ThemeContextType = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init a partir do storage (evita setState dentro do effect)
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'dark';
    const savedLocal = window.localStorage.getItem('pdv_theme') as ThemeName | null;
    let saved = (window.sessionStorage.getItem('pdv_theme') as ThemeName | null) || savedLocal || 'dark';
    if (saved !== 'dark' && saved !== 'light' && saved !== 'code') saved = 'dark';
    try { document.documentElement.setAttribute('data-theme', saved); } catch {}
    return saved;
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('pdv_theme', t);
      window.localStorage.setItem('pdv_theme', t);
    }
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
