export const colors = {
  // Brand Colors
  primary: "#08A9F5",     // Primary Blue
  primaryBright: "#19B5FF", // Bright Blue
  secondary: "#14B8A6",   // Teal
  accent: "#FF7A00",      // Primary Orange
  accentHover: "#E96800", // Orange Hover/Pressed
  
  // Backgrounds & Surfaces
  background: "#08111F",  // Background
  surface: "#0F1B29",     // Primary Surface
  surfaceAlt: "#142334",  // Secondary Surface
  
  // Text
  text: "#FFFFFF",        // Primary Text
  textMuted: "#B8C4D1",   // Secondary Text
  textLight: "#8A98A8",   // Muted Text
  textHighlight: "#FFB866", // Price highlight

  // Borders & Lines
  line: "#25364A",        // Card Border
  lineLight: "#25364A",
  lineFocus: "#08A9F5",

  // Status & Feedback Colors
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",

  white: "#FFFFFF",
  black: "#000000"
};

export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.3
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text
  },
  h4: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textLight,
    lineHeight: 20
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text
  },
  caption: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted
  },
  captionBold: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted
  },
  number: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999
};

export const shadows = {
  soft: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  elevated: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6
  }
};

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows
};

export default theme;
