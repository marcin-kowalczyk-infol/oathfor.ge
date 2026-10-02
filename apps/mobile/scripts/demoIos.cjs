// Builds the demo development build for an iOS simulator from source (ADR 0006).
// Usage from apps/mobile: npm run demo:build-ios -- [--device "iPhone 18 Pro"] [--port 8083]
// The port is compiled into the binary and must match `npm run demo -- --localhost --port <port>`.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const demo = path.resolve(__dirname, '../demo');
const ios = path.join(demo, 'ios');
const APP = 'build/Build/Products/Debug-iphonesimulator/OathforgeDemo.app';

// The generated Podfile only defaults these variables (`||=`). An exported `1` links the
// precompiled React Native core, which does not contain the patched image view.
function buildEnvironment(env, port) {
  for (const name of ['RCT_USE_PREBUILT_RNCORE', 'RCT_USE_RN_DEP']) {
    if (env[name] === '1') throw new Error(`${name}=1 links the unpatched prebuilt React Native. Unset it and rerun.`);
  }
  // CocoaPods aborts with "Unicode Normalization not appropriate for ASCII-8BIT" without a UTF-8 locale.
  const utf8 = value => (/utf-?8/i.test(value ?? '') ? value : 'en_US.UTF-8');
  return { ...env, NODE_ENV: 'development', OATHFORGE_DEMO: '1', RCT_METRO_PORT: String(port), LANG: utf8(env.LANG), LC_ALL: utf8(env.LC_ALL) };
}

function parseArguments(argv) {
  const options = { device: 'iPhone 18 Pro', port: 8082 };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === '--device' && value) options.device = value;
    else if (flag === '--port' && /^\d+$/.test(value ?? '')) options.port = Number(value);
    else throw new Error(`Unsupported argument ${flag}. Use --device <simulator name or UDID> and --port <number>.`);
  }
  return options;
}

function buildSteps({ device, port }) {
  return [
    { command: process.execPath, args: [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'ios', '--no-install', '--clean'], cwd: demo },
    { command: 'pod', args: ['install'], cwd: ios, checkSourceBuild: true },
    {
      command: 'xcodebuild',
      args: ['-workspace', 'OathforgeDemo.xcworkspace', '-scheme', 'OathforgeDemo', '-configuration', 'Debug',
        '-destination', `platform=iOS Simulator,name=${device}`, '-derivedDataPath', 'build', `RCT_METRO_PORT=${port}`, 'build'],
      cwd: ios,
    },
    { command: 'xcrun', args: ['simctl', 'install', device, APP], cwd: ios },
  ];
}

function assertSourceBuild(podOutput) {
  if (!podOutput.includes('[ReactNativeCore] Building from source: true')) {
    throw new Error('pod install did not build React Native core from source, the prebuilt core ignores the patch.');
  }
}

if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  const env = buildEnvironment(process.env, options.port);
  for (const step of buildSteps(options)) {
    const result = spawnSync(step.command, step.args, { cwd: step.cwd, env, stdio: step.checkSourceBuild ? ['inherit', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
    if (step.checkSourceBuild) process.stdout.write(result.stdout ?? '');
    if (result.status !== 0) process.exit(result.status ?? 1);
    if (step.checkSourceBuild) assertSourceBuild(result.stdout ?? '');
  }
  console.log(`Installed on ${options.device}. Start Metro with: npm run demo -- --localhost --port ${options.port}`);
}

module.exports = { buildEnvironment, buildSteps, assertSourceBuild, parseArguments };
