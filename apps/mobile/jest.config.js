module.exports = {
  preset: 'jest-expo',
  // Fails a test on an unexpected console.error or console.warn (MVP-22-G33).
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
