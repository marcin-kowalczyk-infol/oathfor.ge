const path = require('node:path');
const { demoArguments } = require('./demo.cjs');
const demo = path.resolve(__dirname, '../demo');

test('the demo is served on port 8082 by default', () => {
  expect(demoArguments(['--ios', '--localhost'])).toEqual(['start', demo, '--port', '8082', '--ios', '--localhost']);
});

test('a caller port replaces the default', () => {
  expect(demoArguments(['--localhost', '--port', '8083'])).toEqual(['start', demo, '--localhost', '--port', '8083']);
});
