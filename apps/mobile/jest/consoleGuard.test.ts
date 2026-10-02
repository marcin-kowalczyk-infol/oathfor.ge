import { createConsoleGuard, expectConsole } from './consoleGuard';

test('an unannounced warning or error is reported with its formatted text', () => {
  const guard = createConsoleGuard();
  guard.record('warn', ['%s is deprecated', 'Thing'], '');
  guard.record('error', ['broken'], '');
  expect(guard.settle()).toBe('Unexpected console.warn:\nThing is deprecated\n\nUnexpected console.error:\nbroken');
});

test('a report names the first project frames of the call', () => {
  const guard = createConsoleGuard();
  const stack = ['Error', '    at record (jest/consoleGuard.ts:1:1)', '    at warn (node_modules/react/index.js:2:2)', '    at Chip (src/oaths/Chip.tsx:3:3)'].join('\n');
  guard.record('warn', ['late'], stack);
  expect(guard.settle()).toBe('Unexpected console.warn:\nlate\nCalled from:\nat Chip (src/oaths/Chip.tsx:3:3)');
});

test('an announced message is accepted once, and the next test starts clean', () => {
  const guard = createConsoleGuard();
  guard.expect('warn', /deprecated/);
  guard.record('warn', ['Thing is deprecated']);
  expect(guard.settle()).toBeNull();
  guard.record('warn', ['Thing is deprecated']);
  expect(guard.settle()).toMatch(/^Unexpected console\.warn/);
});

test('an announcement matches only its own level', () => {
  const guard = createConsoleGuard();
  guard.expect('warn', /broken/);
  guard.record('error', ['broken'], '');
  expect(guard.settle()).toBe('Unexpected console.error:\nbroken\n\nExpected console.warn matching /broken/ was not called.');
});

test('an announcement that never happens fails, so the allow-list cannot go stale', () => {
  const guard = createConsoleGuard();
  guard.expect('error', /never/);
  expect(guard.settle()).toBe('Expected console.error matching /never/ was not called.');
});

test('the setup routes the real console through the shared guard', () => {
  expectConsole('warn', /^routed through the guard$/);
  console.warn('routed through the guard');
});
