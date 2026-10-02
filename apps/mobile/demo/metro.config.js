const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { assertDevelopmentDemo } = require('./guard.cjs');
const { agentWorktreesPattern } = require('./worktreeBlock.cjs');
assertDevelopmentDemo(process.env);
const config = getDefaultConfig(__dirname);
// The isolated entry consumes the real UI and server-owned bilingual rule fixture.
// A task worktree may link node_modules to another checkout. Metro only serves watched real paths.
const modules = fs.realpathSync(path.resolve(__dirname, '../node_modules'));
const root = path.resolve(__dirname, '../../..');
config.watchFolders = [...new Set([root, modules])];
config.resolver.nodeModulesPaths = [modules];
// Agent worktrees are full checkouts inside the root. Their edits would Fast Refresh the running demo.
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), agentWorktreesPattern(root)];
const transform = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  if (!args[1].dev) throw new Error('Oathforge demo is development-only; production bundling is disabled.');
  return transform ? transform(...args) : { transform: { experimentalImportSupport: false, inlineRequires: false } };
};
module.exports = config;
