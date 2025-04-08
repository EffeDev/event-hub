// Base Jest configuration for all packages
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts', // Exclude index.ts files from coverage
  ],
  coverageReporters: ['text', 'lcov', 'json', 'html'],
  testMatch: ['**/*.spec.ts'],
  // Set default coverage thresholds to 100% for all packages
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
