const path = require('node:path');
const { buildEnvironment, buildSteps, assertSourceBuild, parseArguments } = require('./demoIos.cjs');

const demo = path.resolve(__dirname, '../demo');

test('an exported prebuilt React Native setting is refused, it would link the unpatched core', () => {
  expect(() => buildEnvironment({ RCT_USE_PREBUILT_RNCORE: '1' }, 8083)).toThrow('RCT_USE_PREBUILT_RNCORE');
  expect(() => buildEnvironment({ RCT_USE_RN_DEP: '1' }, 8083)).toThrow('RCT_USE_RN_DEP');
});

test('the build environment marks the development demo and compiles in the Metro port', () => {
  expect(buildEnvironment({ PATH: '/bin', RCT_USE_PREBUILT_RNCORE: '0' }, 8083)).toEqual({
    PATH: '/bin',
    RCT_USE_PREBUILT_RNCORE: '0',
    NODE_ENV: 'development',
    OATHFORGE_DEMO: '1',
    RCT_METRO_PORT: '8083',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
  });
});

test('pod install gets a UTF-8 locale, a caller UTF-8 locale is kept', () => {
  expect(buildEnvironment({ LANG: '', LC_ALL: '' }, 8083)).toMatchObject({ LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  expect(buildEnvironment({ LANG: 'C', LC_ALL: 'POSIX' }, 8083)).toMatchObject({ LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  expect(buildEnvironment({ LANG: 'pl_PL.UTF-8', LC_ALL: 'pl_PL.utf8' }, 8083)).toMatchObject({ LANG: 'pl_PL.UTF-8', LC_ALL: 'pl_PL.utf8' });
});

test('arguments default to the iPhone 18 Pro and port 8082', () => {
  expect(parseArguments([])).toEqual({ device: 'iPhone 18 Pro', port: 8082 });
  expect(parseArguments(['--device', 'iPhone SE (3rd generation)', '--port', '8083'])).toEqual({ device: 'iPhone SE (3rd generation)', port: 8083 });
  expect(() => parseArguments(['--port', 'x'])).toThrow('--port');
});

test('the steps prebuild, install pods, build Debug for the simulator and install the app', () => {
  const steps = buildSteps({ device: 'iPhone 18 Pro', port: 8083 });
  expect(steps.map(step => [step.command, step.cwd])).toEqual([
    [process.execPath, demo],
    ['pod', path.join(demo, 'ios')],
    ['xcodebuild', path.join(demo, 'ios')],
    ['xcrun', path.join(demo, 'ios')],
  ]);
  expect(steps[0].args.slice(1)).toEqual(['prebuild', '--platform', 'ios', '--no-install', '--clean']);
  expect(steps[1].checkSourceBuild).toBe(true);
  expect(steps[2].args).toEqual(expect.arrayContaining(['-configuration', 'Debug', '-destination', 'platform=iOS Simulator,name=iPhone 18 Pro', 'RCT_METRO_PORT=8083']));
  expect(steps[3].args).toEqual(['simctl', 'install', 'iPhone 18 Pro', 'build/Build/Products/Debug-iphonesimulator/OathforgeDemo.app']);
});

test('pod install output must confirm that React Native core builds from source', () => {
  expect(() => assertSourceBuild('[ReactNativeCore] Building from source: true\n')).not.toThrow();
  expect(() => assertSourceBuild('[ReactNativeCore] Building from source: false\n')).toThrow('prebuilt');
  expect(() => assertSourceBuild('')).toThrow('prebuilt');
});
