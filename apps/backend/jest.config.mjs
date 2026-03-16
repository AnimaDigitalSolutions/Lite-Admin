/** @type {import('jest').Config} */
process.env.LOG_LEVEL = 'silent';

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@lite/shared$': '<rootDir>/../../packages/shared/dist/index.js',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json',
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
};
