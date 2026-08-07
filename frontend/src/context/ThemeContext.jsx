import React, { createContext, useContext } from 'react';
import { LIGHT_COLORS } from '../constants/config';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const theme = 'light';
  const toggleTheme = () => {};
  const colors = LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
