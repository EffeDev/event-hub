// Package-specific Jest configuration
import baseConfig from '../../jest.config.js';

export default {
  ...baseConfig,
  displayName: '@effedev/event-hub',
  coverageDirectory: '<rootDir>/coverage',
  // Maintain 100% coverage requirement from base config
  // Package-specific exclusions can be added here if needed
};
