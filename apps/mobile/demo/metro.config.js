const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { assertDevelopmentDemo } = require('./guard.cjs');
assertDevelopmentDemo(process.env);
const config = getDefaultConfig(__dirname);
// The isolated entry consumes the real UI and server-owned bilingual rule fixture.
config.watchFolders = [path.resolve(__dirname, '../../..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, '../node_modules')];
const transform = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  if (!args[1].dev) throw new Error('Oathforge demo is development-only; production bundling is disabled.');
  return transform ? transform(...args) : { transform: { experimentalImportSupport: false, inlineRequires: false } };
};
module.exports = config;
