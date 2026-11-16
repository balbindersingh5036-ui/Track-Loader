/**
 * Banner Carousel Dimension & Resize Mode Helper
 * Ensures banners fit within the 145-170px requirement and choose appropriate resize modes.
 */

export const MIN_BANNER_HEIGHT = 145;
export const MAX_BANNER_HEIGHT = 170;
export const DEFAULT_MOBILE_BANNER_HEIGHT = 158;
export const DEFAULT_DESKTOP_BANNER_HEIGHT = 170;

/**
 * Determines whether a banner should be displayed with "contain" or "cover".
 * - "contain" for app screenshots, diagrams, and promotional artwork.
 * - "cover" for photographic banners, vehicle photos, and marketing hero imagery.
 */
export const resolveBannerResizeMode = (banner) => {
  if (!banner || typeof banner !== 'object') return 'cover';
  if (banner.resizeMode === 'contain' || banner.resizeMode === 'cover') {
    return banner.resizeMode;
  }
  if (banner.imageType === 'screenshot' || banner.imageType === 'artwork' || banner.imageType === 'diagram') {
    return 'contain';
  }
  const url = (banner.imageUrl || '').toLowerCase();
  const title = (banner.title || '').toLowerCase();
  if (
    url.includes('screenshot') ||
    url.includes('artwork') ||
    url.includes('diagram') ||
    url.includes('mockup') ||
    title.includes('screenshot') ||
    title.includes('artwork') ||
    title.includes('diagram')
  ) {
    return 'contain';
  }
  return 'cover';
};

/**
 * Calculates responsive banner height within the 145-170px requirement.
 * Scales smoothly based on viewport width:
 * - Desktop / Tablet (>= 768px): 170px
 * - Compact Mobile (<= 360px): 148px
 * - Standard Mobile (361px - 767px): 158px
 */
export const calculateBannerHeight = (layoutWidth) => {
  if (Number.isFinite(layoutWidth) && layoutWidth >= 768) {
    return DEFAULT_DESKTOP_BANNER_HEIGHT; // 170px
  }
  if (Number.isFinite(layoutWidth) && layoutWidth <= 360) {
    return 148; // 148px for compact devices
  }
  return DEFAULT_MOBILE_BANNER_HEIGHT; // 158px for standard mobile
};
