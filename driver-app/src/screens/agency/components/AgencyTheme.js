export const theme = {
  colors: {
    bg: '#08111F',
    surface: '#0F1B29',
    card: '#142334',
    cardHover: '#182A3D',
    border: '#25364A',
    borderSubtle: '#1A293B',
    primary: '#08A9F5',
    primaryDark: '#0284C7',
    primaryGlow: 'rgba(8, 169, 245, 0.15)',
    accent: '#FF7A00',
    accentGlow: 'rgba(255, 122, 0, 0.15)',
    teal: '#14B8A6',
    tealGlow: 'rgba(20, 184, 166, 0.15)',
    green: '#22C55E',
    greenGlow: 'rgba(34, 197, 94, 0.15)',
    warning: '#F59E0B',
    warningGlow: 'rgba(245, 158, 11, 0.15)',
    danger: '#EF4444',
    dangerGlow: 'rgba(239, 68, 68, 0.15)',
    ink: '#FFFFFF',
    textSecondary: '#B8C4D1',
    muted: '#8A98A8',
    subtle: '#4B5563',
    white: '#FFFFFF',
    black: '#000000'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  typography: {
    title: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3
    },
    subtitle: {
      color: '#B8C4D1',
      fontSize: 13,
      fontWeight: '500'
    },
    sectionTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2
    },
    body: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600'
    },
    caption: {
      color: '#8A98A8',
      fontSize: 12,
      fontWeight: '500'
    },
    tag: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    sizes: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 18,
      xl: 22,
      xxl: 28
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800'
    }
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999
  },
  shadows: {
    card: {}
  }
};

export const statusConfig = (status) => {
  const norm = String(status || 'not_uploaded').toLowerCase();
  switch (norm) {
    case 'approved':
    case 'accepted':
    case 'active':
    case 'verified':
    case 'completed':
      return {
        bg: theme.colors.greenGlow,
        color: theme.colors.green,
        border: 'rgba(34, 197, 94, 0.3)',
        label: norm === 'completed' ? 'Completed' : norm === 'accepted' ? 'Accepted' : 'Verified'
      };
    case 'pending':
    case 'pending_acceptance':
    case 'pending_review':
    case 'in_transit':
    case 'loading':
    case 'unloading':
      return {
        bg: theme.colors.warningGlow,
        color: theme.colors.warning,
        border: 'rgba(245, 158, 11, 0.3)',
        label: norm.includes('acceptance') ? 'Awaiting Acceptance' : norm.includes('transit') ? 'In Transit' : 'Pending'
      };
    case 'rejected':
    case 'suspended':
    case 'cancelled':
    case 'inactive':
      return {
        bg: theme.colors.dangerGlow,
        color: theme.colors.danger,
        border: 'rgba(239, 68, 68, 0.3)',
        label: norm === 'inactive' ? 'Inactive' : norm === 'cancelled' ? 'Cancelled' : norm === 'suspended' ? 'Suspended' : 'Rejected'
      };
    case 'not_uploaded':
    case 'missing':
    case 'unassigned':
    default:
      return {
        bg: 'rgba(138, 152, 168, 0.12)',
        color: theme.colors.muted,
        border: 'rgba(138, 152, 168, 0.25)',
        label: norm === 'unassigned' ? 'Unassigned' : 'Not Uploaded'
      };
  }
};

export default theme;
