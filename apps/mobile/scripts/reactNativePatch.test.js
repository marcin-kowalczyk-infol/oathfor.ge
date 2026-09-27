// Guards the React Native backport for react/react-native#58667 (fix 53bf98b, ADR 0006).
// Drop this test and the patch once the Expo SDK ships a React Native release containing 53bf98b.
const fs = require('node:fs');
const path = require('node:path');

const mobile = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const appConfig = require('../app.json').expo;
const patchFile = path.join(mobile, 'patches', 'react-native+0.86.3.patch');
const imageView = 'React/Fabric/Mounting/ComponentViews/Image/RCTImageComponentView.mm';
const staleGuard = 'observer != _imageResponseObserverProxy.get()';
const perSubscriptionProxy = '_imageResponseObserverProxy = std::make_shared<RCTImageResponseObserverProxy>(self);';

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

test('the patch targets the exact pinned React Native version', () => {
  expect(manifest.dependencies['react-native']).toBe('0.86.3');
  expect(require('react-native/package.json').version).toBe('0.86.3');
  expect(fs.existsSync(patchFile)).toBe(true);
});

test('patch-package is pinned and applies patches after every install', () => {
  expect(manifest.devDependencies['patch-package']).toMatch(/^\d+\.\d+\.\d+$/);
  expect(manifest.scripts.postinstall).toBe('patch-package --error-on-fail');
});

test('the patch only changes the image component view with the upstream guard', () => {
  const patch = fs.readFileSync(patchFile, 'utf8');
  const changedFiles = [...patch.matchAll(/^diff --git a\/(\S+)/gm)].map(match => match[1]);
  expect(changedFiles).toEqual([`node_modules/react-native/${imageView}`]);
  expect(occurrences(patch, `+  if (!_eventEmitter || !_state || ${staleGuard}) {`)).toBe(1);
  expect(occurrences(patch, `+  if (!_eventEmitter || ${staleGuard}) {`)).toBe(1);
  expect(occurrences(patch, `+  if (${staleGuard}) {`)).toBe(1);
  expect(occurrences(patch, `-    ${perSubscriptionProxy}`)).toBe(1);
  expect(occurrences(patch, `+    ${perSubscriptionProxy}`)).toBe(1);
});

test('the installed image component view contains the upstream fix', () => {
  const source = fs.readFileSync(path.join(path.dirname(require.resolve('react-native/package.json')), imageView), 'utf8');
  expect(occurrences(source, staleGuard)).toBe(3);
  const subscribe = source.slice(source.indexOf('- (void)_setStateAndResubscribeImageResponseObserver'), source.indexOf('- (void)prepareForRecycle'));
  expect(subscribe).toContain(perSubscriptionProxy);
  const init = source.slice(source.indexOf('- (instancetype)initWithFrame'), source.indexOf('#pragma mark - RCTComponentViewProtocol'));
  expect(init).not.toContain('RCTImageResponseObserverProxy');
});

const buildProperties = () => appConfig.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')?.[1];

test('native iOS builds compile React Native from source so the patch is used', () => {
  expect(buildProperties()?.ios?.buildReactNativeFromSource).toBe(true);
});

test('the official Expo option adopts the scene life cycle that the iOS 27 SDK requires', () => {
  expect(buildProperties()?.ios?.enableSceneSupport).toBe(true);
  expect(appConfig.plugins.filter(plugin => typeof plugin === 'string' && plugin.startsWith('./'))).toEqual([]);
  expect(fs.existsSync(path.join(mobile, 'plugins'))).toBe(false);
});

test('the demo declares the same native package ranges as the app, so prebuild leaves its package.json unchanged', () => {
  const demo = require('../demo/package.json');
  for (const name of ['expo', 'react', 'react-native']) {
    expect(demo.dependencies[name]).toBe(manifest.dependencies[name]);
  }
});
