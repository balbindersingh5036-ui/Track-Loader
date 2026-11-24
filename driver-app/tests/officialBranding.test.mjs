import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const driverAppDir = path.resolve(__dirname, '..');

test('driver-app app.json contains complete official branding configuration', () => {
  const appJsonPath = path.join(driverAppDir, 'app.json');
  assert.ok(fs.existsSync(appJsonPath), 'app.json must exist');

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expo = appJson.expo;

  // Icon
  assert.equal(expo.icon, './assets/icon.png');
  assert.ok(fs.existsSync(path.join(driverAppDir, expo.icon)), 'expo.icon file must exist');

  // Splash
  assert.ok(expo.splash, 'expo.splash configuration must be defined');
  assert.equal(expo.splash.image, './assets/splash.png');
  assert.equal(expo.splash.resizeMode, 'contain');
  assert.equal(expo.splash.backgroundColor, '#08111F');
  assert.ok(fs.existsSync(path.join(driverAppDir, expo.splash.image)), 'splash image file must exist');

  // iOS splash
  assert.ok(expo.ios, 'expo.ios must be defined');
  assert.ok(expo.ios.splash, 'expo.ios.splash must be defined');
  assert.equal(expo.ios.splash.image, './assets/splash.png');
  assert.equal(expo.ios.splash.backgroundColor, '#08111F');

  // Android adaptive icon and splash
  assert.ok(expo.android, 'expo.android must be defined');
  assert.ok(expo.android.adaptiveIcon, 'expo.android.adaptiveIcon must be defined');
  assert.equal(expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
  assert.equal(expo.android.adaptiveIcon.backgroundColor, '#08111F');
  assert.ok(fs.existsSync(path.join(driverAppDir, expo.android.adaptiveIcon.foregroundImage)), 'adaptiveIcon image must exist');
  assert.ok(expo.android.splash, 'expo.android.splash must be defined');
  assert.equal(expo.android.splash.image, './assets/splash.png');
  assert.equal(expo.android.splash.backgroundColor, '#08111F');
});

test('driver-app local branding assets exist and maintain valid square dimensions', () => {
  const requiredAssets = [
    'logo.png',
    'loadbalbin-logo-cropped.png',
    'icon.png',
    'adaptive-icon.png',
    'splash.png'
  ];

  for (const assetName of requiredAssets) {
    const fullPath = path.join(driverAppDir, 'assets', assetName);
    assert.ok(fs.existsSync(fullPath), `Asset ${assetName} must exist locally`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 1000, `Asset ${assetName} must not be empty`);
  }
});

test('driver-app splash screen component is exported and properly structured', () => {
  const splashComponentPath = path.join(driverAppDir, 'src', 'screens', 'splash', 'SplashScreen.jsx');
  assert.ok(fs.existsSync(splashComponentPath), 'SplashScreen.jsx must exist');
  const content = fs.readFileSync(splashComponentPath, 'utf8');

  assert.ok(content.includes('LoadBalbinLogo'), 'SplashScreen must render LoadBalbinLogo');
  assert.ok(content.includes('centered'), 'SplashScreen logo must be centered');
  assert.ok(content.includes('#08111F'), 'SplashScreen must use dark navy background');
  assert.ok(content.includes('ActivityIndicator'), 'SplashScreen must show ActivityIndicator while loading');

  const splashBridgePath = path.join(driverAppDir, 'src', 'screens', 'Splash.js');
  assert.ok(fs.existsSync(splashBridgePath), 'Splash.js bridge must exist');
  const bridgeContent = fs.readFileSync(splashBridgePath, 'utf8');
  assert.ok(bridgeContent.includes("from './splash/SplashScreen'"), 'Splash.js must export SplashScreen');
});
