import { registerRootComponent } from 'expo';
if (!__DEV__) throw new Error('Oathforge demo is development-only.');
// Conditional require ensures release execution never initializes DUMMY adapters.
if (__DEV__) registerRootComponent(require('./DemoApp').default);
