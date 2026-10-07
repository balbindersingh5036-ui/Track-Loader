export const colors = {
  // Brand Colors
  primary: "#08A9F5",     // Primary Blue
  secondary: "#14B8A6",   // Secondary Teal
  accent: "#FF7A00",      // Accent Orange
  
  // Backgrounds & Surfaces
  background: "#0B1118",  // Very dark navy / charcoal
  surface: "#101820",     // Dark blue-gray cards
  surfaceAlt: "#1A2430",  // Slightly lighter card / hover
  
  // Text
  text: "#FFFFFF",        // White headings/primary text
  textMuted: "#9CA3AF",   // Light gray secondary text
  textLight: "#E5E7EB",

  // Borders & Lines
  line: "#2A3746",
  lineLight: "#374151",
  lineFocus: "#08A9F5",

  // Status & Feedback Colors
  success: "#10B981",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  successText: "#065F46",

  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  warningText: "#92400E",

  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerText: "#991B1B",

  info: "#0284C7",
  infoBg: "#F0F9FF",
  infoBorder: "#BAE6FD",
  infoText: "#075985",

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
