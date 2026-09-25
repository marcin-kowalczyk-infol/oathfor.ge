const { assertDevelopmentDemo } = require('./guard.cjs');
test('production and unmarked invocations reject demo adapters', () => {
  expect(() => assertDevelopmentDemo({ NODE_ENV: 'production', OATHFORGE_DEMO: '1' })).toThrow('development-only');
  expect(() => assertDevelopmentDemo({ NODE_ENV: 'development' })).toThrow('development-only');
});
test('explicit development launcher may run the demo', () => {
  expect(() => assertDevelopmentDemo({ NODE_ENV: 'development', OATHFORGE_DEMO: '1' })).not.toThrow();
});
