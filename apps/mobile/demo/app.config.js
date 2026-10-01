const path = require('path');
const { assertDevelopmentDemo } = require('./guard.cjs');
module.exports = () => {
  assertDevelopmentDemo(process.env);
  const expo = require('../app.json').expo;
  // Expo reads locale files from the project root, which is demo/ here. The permission strings live beside the app, not in demo/locales.
  const locales = Object.fromEntries(Object.entries(expo.locales ?? {}).map(([locale, file]) => [locale, path.posix.join('..', file)]));
  // Unregistered placeholder for local simulator development builds only (ADR 0006).
  return { ...expo, locales, name: 'Oathforge Demo', slug: 'oathforge-demo', ios: { ...expo.ios, bundleIdentifier: 'com.placeholder.oathforge.demo' } };
};
