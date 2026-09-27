const { spawn } = require('node:child_process');
const path = require('node:path');
if (process.env.NODE_ENV === 'production') throw new Error('Oathforge demo is development-only.');

// A caller-supplied --port replaces the default 8082, e.g. when another worktree serves 8082
// or when the demo development build was compiled for another Metro port.
function demoArguments(argv) {
  const port = argv.includes('--port') ? [] : ['--port', '8082'];
  return ['start', path.resolve(__dirname, '../demo'), ...port, ...argv];
}

if (require.main === module) {
  const cli = require.resolve('expo/bin/cli');
  const child = spawn(process.execPath, ['--dns-result-order=ipv4first', cli, ...demoArguments(process.argv.slice(2))], {
    stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development', OATHFORGE_DEMO: '1' },
  });
  child.on('exit', code => process.exit(code ?? 1));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}

module.exports = { demoArguments };
