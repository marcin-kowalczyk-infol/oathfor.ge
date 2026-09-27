const { assertDevelopmentDemo } = require('./guard.cjs');
module.exports = () => {
  assertDevelopmentDemo(process.env);
  const expo = require('../app.json').expo;
  // Unregistered placeholder for local simulator development builds only (ADR 0006).
  return { ...expo, name: 'Oathforge Demo', slug: 'oathforge-demo', ios: { ...expo.ios, bundleIdentifier: 'com.placeholder.oathforge.demo' } };
};
