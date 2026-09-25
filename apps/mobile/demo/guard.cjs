exports.assertDevelopmentDemo = function (environment) {
  if (environment.NODE_ENV !== 'development' || environment.OATHFORGE_DEMO !== '1') {
    throw new Error('Oathforge demo is development-only; use npm run demo.');
  }
};
