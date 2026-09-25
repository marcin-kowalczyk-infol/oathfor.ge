const { spawn } = require('node:child_process');
const path = require('node:path');
if (process.env.NODE_ENV === 'production') throw new Error('Oathforge demo is development-only.');
const cli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, ['--dns-result-order=ipv4first', cli, 'start', path.resolve(__dirname, '../demo'), '--port', '8082', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development', OATHFORGE_DEMO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
