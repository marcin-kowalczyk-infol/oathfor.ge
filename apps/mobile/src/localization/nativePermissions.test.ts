import app from '../../app.json';
import nativeEn from './native/en.json';
import nativePl from './native/pl.json';
import { validateCatalogs } from './validateCatalogs';

// iOS reads the permission prompts from Info.plist. The English text is the base, Polish comes from Expo's per-locale InfoPlist.strings.
const plugin = app.expo.plugins.find(entry => Array.isArray(entry) && entry[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined;
const locales = (app.expo as { locales?: Record<string, string> }).locales ?? {};

test('the image picker asks for the camera and Photos with our own strings and never for the microphone', () => {
  expect(plugin).toBeDefined();
  expect(plugin![1]).toEqual({ cameraPermission: nativeEn.ios.NSCameraUsageDescription, photosPermission: nativeEn.ios.NSPhotoLibraryUsageDescription, microphonePermission: false });
});

test('Polish and English permission strings are complete, distinct and follow the content rules', () => {
  expect(locales).toEqual({ pl: './src/localization/native/pl.json', en: './src/localization/native/en.json' });
  expect(Object.keys(nativePl.ios).sort()).toEqual(['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']);
  expect(Object.keys(nativeEn.ios).sort()).toEqual(['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']);
  expect(validateCatalogs({ pl: nativePl.ios, en: nativeEn.ios })).toEqual([]);
  expect(nativePl.ios.NSCameraUsageDescription).not.toBe(nativeEn.ios.NSCameraUsageDescription);
});

// Expo resolves locale files against the project root. The demo's root is demo/, whose locales folder holds the controls copy.
test('the demo build reads the same permission files, not its controls catalog', () => {
  const environment = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'development', OATHFORGE_DEMO: '1' });
  try {
    const config = require('../../demo/app.config.js')();
    expect(config.locales).toEqual({ pl: '../src/localization/native/pl.json', en: '../src/localization/native/en.json' });
  } finally { process.env = environment; }
});
