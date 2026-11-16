import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_BANNER_HEIGHT,
  MAX_BANNER_HEIGHT,
  DEFAULT_MOBILE_BANNER_HEIGHT,
  DEFAULT_DESKTOP_BANNER_HEIGHT,
  resolveBannerResizeMode,
  calculateBannerHeight
} from '../src/utils/bannerHelper.mjs';

test('calculateBannerHeight enforces 145-170px height requirements across viewports', () => {
  // Standard mobile (390px, 412px)
  const mobileHeight = calculateBannerHeight(390);
  assert.equal(mobileHeight, 158);
  assert.ok(mobileHeight >= MIN_BANNER_HEIGHT && mobileHeight <= MAX_BANNER_HEIGHT);

  const mobile412Height = calculateBannerHeight(412);
  assert.equal(mobile412Height, 158);
  assert.ok(mobile412Height >= MIN_BANNER_HEIGHT && mobile412Height <= MAX_BANNER_HEIGHT);

  // Compact mobile (360px, 320px)
  const compactMobileHeight = calculateBannerHeight(360);
  assert.equal(compactMobileHeight, 148);
  assert.ok(compactMobileHeight >= MIN_BANNER_HEIGHT && compactMobileHeight <= MAX_BANNER_HEIGHT);

  const smallMobileHeight = calculateBannerHeight(320);
  assert.equal(smallMobileHeight, 148);
  assert.ok(smallMobileHeight >= MIN_BANNER_HEIGHT && smallMobileHeight <= MAX_BANNER_HEIGHT);

  // Desktop / Tablet width (768px, 1024px)
  const desktopHeight = calculateBannerHeight(1024);
  assert.equal(desktopHeight, 170);
  assert.ok(desktopHeight >= MIN_BANNER_HEIGHT && desktopHeight <= MAX_BANNER_HEIGHT);
});

test('resolveBannerResizeMode chooses cover for photographic banners and vehicle photos', () => {
  const photoBanner = {
    title: 'Earn More with LoadBalbin',
    imageUrl: 'https://res.cloudinary.com/loadbalbin/image/upload/v1/banners/driver_hero.jpg'
  };
  assert.equal(resolveBannerResizeMode(photoBanner), 'cover');

  const truckBanner = {
    title: 'Fleet Onboarding',
    imageUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7'
  };
  assert.equal(resolveBannerResizeMode(truckBanner), 'cover');
});

test('resolveBannerResizeMode chooses contain for app screenshots, diagrams, and artwork', () => {
  const screenshotBanner = {
    title: 'App Navigation Guide',
    imageUrl: 'https://res.cloudinary.com/loadbalbin/image/upload/v1/banners/app_screenshot_v2.png'
  };
  assert.equal(resolveBannerResizeMode(screenshotBanner), 'contain');

  const artworkBanner = {
    title: 'Bonus Scheme Artwork',
    imageType: 'artwork',
    imageUrl: 'https://res.cloudinary.com/loadbalbin/image/upload/v1/banners/bonus_ill.png'
  };
  assert.equal(resolveBannerResizeMode(artworkBanner), 'contain');

  const diagramBanner = {
    title: 'Driver Earnings Flow',
    imageType: 'diagram',
    imageUrl: 'https://res.cloudinary.com/loadbalbin/image/upload/v1/banners/flow.png'
  };
  assert.equal(resolveBannerResizeMode(diagramBanner), 'contain');

  const explicitContainBanner = {
    title: 'Special Diagram',
    resizeMode: 'contain',
    imageUrl: 'https://res.cloudinary.com/loadbalbin/image/upload/v1/banners/diagram.png'
  };
  assert.equal(resolveBannerResizeMode(explicitContainBanner), 'contain');
});

test('resolveBannerResizeMode handles null, undefined, or missing properties safely', () => {
  assert.equal(resolveBannerResizeMode(null), 'cover');
  assert.equal(resolveBannerResizeMode(undefined), 'cover');
  assert.equal(resolveBannerResizeMode({}), 'cover');
});
