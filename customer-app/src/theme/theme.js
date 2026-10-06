export const colors = {
  // Brand Primary
  primary: "#086B64",
  primaryDark: "#064D49",
  primaryLight: "#E6F4F2",
  primaryMuted: "#CCECE7",

  // Deep Navy & Inks
  navy: "#0F172A",
  navyLight: "#1E293B",
  ink: "#1E293B",
  inkSecondary: "#334155",
  muted: "#64748B",
  mutedLight: "#94A3B8",

  // Canvas & Surfaces
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  surfaceSubtle: "#F8FAFC",

  // Borders & Lines
  line: "#E2E8F0",
  lineLight: "#F1F5F9",
  lineFocus: "#086B64",

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
    color: colors.navy,
    letterSpacing: -0.5
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy,
    letterSpacing: -0.3
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy
  },
  h4: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.ink,
    lineHeight: 20
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink
  },
  caption: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted
  },
  captionBold: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted
  },
  number: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy
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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  elevated: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5
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
