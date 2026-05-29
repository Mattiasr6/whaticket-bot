# Pipeline: BotCajero — Bot moderador WhatsApp + asistente admin por comandos privados (backend Node.js)

## Phase: code-admin

## DarkMode Palette Restoration

**Files changed:**
- `frontend/src/context/DarkMode/index.js` — Replaced bare-bones palette with full Tailwind Slate/Blue:
  - `LIGHT_PALETTE`: Slate 50 bg, Slate 900 text, Blue-600 primary
  - `DARK_PALETTE`: Slate 900 bg, Slate 100 text, Blue-500 primary
  - `TYPOGRAPHY`: Inter font, weighted headings, no uppercase buttons
  - `SHAPES`: borderRadius 8
  - `OVERRIDES`: Button, Card, Paper, Dialog, Chip, TableHead, Drawer styles
  - `type` set separately from palette spread (`{ type: "dark", ...DARK_PALETTE }`)
- `frontend/src/index.js` — Removed standalone `<CssBaseline>`, wrapped `<App>` with DarkMode's `<ThemeProvider>` (which includes CssBaseline)

**Architecture:** MUI nested ThemeProviders: DarkMode (outer) → App (inner with locale). Merge works correctly.

**Verification:** ESLint passes on both files.