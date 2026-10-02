/** @jest-environment node */
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const saved = { NODE_ENV: process.env.NODE_ENV, OATHFORGE_DEMO: process.env.OATHFORGE_DEMO };
let config;

beforeAll(() => {
  process.env.NODE_ENV = 'development';
  process.env.OATHFORGE_DEMO = '1';
  jest.isolateModules(() => {
    config = require('./metro.config.js');
  });
});

afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const blockedBy = (patterns, file) => patterns.some((pattern) => pattern.test(file));

test('demo Metro ignores agent worktrees under the watched root', () => {
  const { blockList } = config.resolver;
  expect(config.watchFolders).toContain(root);
  expect(blockedBy(blockList, `${root}/.claude/worktrees/x/apps/mobile/src/a.ts`)).toBe(true);
  expect(blockedBy(blockList, `${root}/.claude/worktrees`)).toBe(true);
  expect(blockedBy(blockList, `${root}/apps/mobile/src/a.ts`)).toBe(false);
});

test('demo Metro keeps the default blockList entries', () => {
  expect(blockedBy(config.resolver.blockList, `${root}/apps/mobile/src/__tests__/a.ts`)).toBe(true);
  expect(config.resolver.blockList.every((pattern) => pattern.flags === '')).toBe(true);
});

test('a root inside a worktree blocks only its own nested worktrees', () => {
  const { agentWorktreesPattern } = require('./worktreeBlock.cjs');
  const outer = agentWorktreesPattern('/repo');
  expect(outer.test('/repo/.claude/worktrees/x/apps/mobile/src/a.ts')).toBe(true);
  expect(outer.test('/repo/.claude/worktrees')).toBe(true);
  expect(outer.test('/repo/apps/mobile/src/a.ts')).toBe(false);
  expect(outer.test('/repo/.claude/worktreesx/a.ts')).toBe(false);
  const inner = agentWorktreesPattern('/repo/.claude/worktrees/w1');
  expect(inner.test('/repo/.claude/worktrees/w1/apps/mobile/src/a.ts')).toBe(false);
  expect(inner.test('/repo/.claude/worktrees/w1/.claude/worktrees/w2/apps/mobile/src/a.ts')).toBe(true);
  const special = agentWorktreesPattern('/r.e+po');
  expect(special.test('/rXe+po/.claude/worktrees/x/a.ts')).toBe(false);
  expect(special.test('/r.e+po/.claude/worktrees/x/a.ts')).toBe(true);
});
