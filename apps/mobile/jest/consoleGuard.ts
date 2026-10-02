import { format } from 'node:util';

// MVP-22-G33: a test fails on any console.error or console.warn it did not announce.
// A test that asserts a warning on purpose calls expectConsole before the code under test runs.
export type ConsoleLevel = 'error' | 'warn';

type Expectation = { level: ConsoleLevel; pattern: RegExp; seen: boolean };

export function createConsoleGuard() {
  let calls: { level: ConsoleLevel; message: string; origin: string }[] = [];
  let expectations: Expectation[] = [];
  return {
    record(level: ConsoleLevel, args: unknown[], stack = new Error().stack ?? '') {
      calls.push({ level, message: format(...args), origin: origin(stack) });
    },
    expect(level: ConsoleLevel, pattern: RegExp) {
      expectations.push({ level, pattern, seen: false });
    },
    // Returns what went wrong since the last call, or null, and starts over.
    settle(): string | null {
      const unexpected = calls.filter(call => {
        const match = expectations.find(expectation => expectation.level === call.level && expectation.pattern.test(call.message));
        if (match) match.seen = true;
        return !match;
      });
      const unmet = expectations.filter(expectation => !expectation.seen);
      calls = [];
      expectations = [];
      const problems = [
        ...unexpected.map(call => `Unexpected console.${call.level}:\n${call.message}${call.origin && `\nCalled from:\n${call.origin}`}`),
        ...unmet.map(expectation => `Expected console.${expectation.level} matching ${expectation.pattern} was not called.`),
      ];
      return problems.length ? problems.join('\n\n') : null;
    },
  };
}

// The first project frames of the call, so a failure names the code that warned, not this guard.
function origin(stack: string) {
  return stack.split('\n').filter(line => line.trim().startsWith('at ') && !/node_modules|consoleGuard|jest\.setup/.test(line))
    .slice(0, 3).map(line => line.trim()).join('\n');
}

export const consoleGuard = createConsoleGuard();

export function expectConsole(level: ConsoleLevel, pattern: RegExp) {
  consoleGuard.expect(level, pattern);
}
