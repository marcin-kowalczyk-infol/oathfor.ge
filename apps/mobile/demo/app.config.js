const { assertDevelopmentDemo } = require('./guard.cjs');
module.exports = () => {
  assertDevelopmentDemo(process.env);
  return { ...require('../app.json').expo, name: 'Oathforge Demo', slug: 'oathforge-demo' };
};
