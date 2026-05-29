import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createMuiTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

const ThemeContext = createContext();

const LIGHT_PALETTE = {
  primary: { main: "#2563eb", light: "#60a5fa", dark: "#1d4ed8", contrastText: "#ffffff" },
  secondary: { main: "#7c3aed", light: "#a78bfa", dark: "#6d28d9", contrastText: "#ffffff" },
  success: { main: "#059669", light: "#d1fae5", dark: "#047857", contrastText: "#ffffff" },
  warning: { main: "#d97706", light: "#fef3c7", dark: "#b45309", contrastText: "#ffffff" },
  error: { main: "#dc2626", light: "#fee2e2", dark: "#b91c1c", contrastText: "#ffffff" },
  background: { default: "#f8fafc", paper: "#ffffff" },
  text: { primary: "#0f172a", secondary: "#64748b", disabled: "#cbd5e1", hint: "#94a3b8" },
  divider: "#e2e8f0",
  action: {
    hover: "rgba(15, 23, 42, 0.04)",
    selected: "rgba(37, 99, 235, 0.08)",
    disabled: "rgba(15, 23, 42, 0.26)",
    disabledBackground: "rgba(15, 23, 42, 0.12)",
  },
};

const DARK_PALETTE = {
  primary: { main: "#3b82f6", light: "#93c5fd", dark: "#2563eb", contrastText: "#ffffff" },
  secondary: { main: "#8b5cf6", light: "#c4b5fd", dark: "#7c3aed", contrastText: "#ffffff" },
  success: { main: "#10b981", light: "#a7f3d0", dark: "#059669", contrastText: "#ffffff" },
  warning: { main: "#f59e0b", light: "#fde68a", dark: "#d97706", contrastText: "#ffffff" },
  error: { main: "#ef4444", light: "#fecaca", dark: "#dc2626", contrastText: "#ffffff" },
  background: { default: "#0f172a", paper: "#1e293b" },
  text: { primary: "#f1f5f9", secondary: "#94a3b8", disabled: "#475569", hint: "#64748b" },
  divider: "#334155",
  action: {
    hover: "rgba(241, 245, 249, 0.05)",
    selected: "rgba(59, 130, 246, 0.16)",
    disabled: "rgba(241, 245, 249, 0.3)",
    disabledBackground: "rgba(241, 245, 249, 0.12)",
  },
};

const TYPOGRAPHY = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h4: { fontWeight: 700, fontSize: "1.75rem" },
  h5: { fontWeight: 700, fontSize: "1.35rem" },
  h6: { fontWeight: 600, fontSize: "1.1rem" },
  subtitle1: { fontWeight: 500 },
  body1: { fontSize: "0.9rem" },
  body2: { fontSize: "0.82rem" },
  button: { textTransform: "none", fontWeight: 600 },
};

const SHAPES = {
  borderRadius: 8,
};

const OVERRIDES = {
  MuiButton: {
    root: { borderRadius: 8, padding: "8px 20px" },
    containedPrimary: {
      boxShadow: "none",
      "&:hover": { boxShadow: "0 2px 8px rgba(37,99,235,0.3)" },
    },
  },
  MuiCard: {
    root: {
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
    },
  },
  MuiPaper: { rounded: { borderRadius: 12 } },
  MuiDialog: { paper: { borderRadius: 12 } },
  MuiChip: { root: { borderRadius: 6 } },
  MuiTableHead: {
    root: { "& .MuiTableCell-head": { fontWeight: 600 } },
  },
  MuiDrawer: {
    paper: { borderRight: "1px solid" },
  },
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  const theme = useMemo(() => {
    const palette = darkMode
      ? { type: "dark", ...DARK_PALETTE }
      : { type: "light", ...LIGHT_PALETTE };

    return createMuiTheme({
      palette,
      typography: TYPOGRAPHY,
      shape: SHAPES,
      overrides: OVERRIDES,
      props: {
        MuiButton: { disableElevation: true },
        MuiCard: { elevation: 0 },
      },
    });
  }, [darkMode]);

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
