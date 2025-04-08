// Package-specific Rollup configuration
import { createRollupConfig } from '../../rollup.config.js';

// Use the base configuration with package-specific path
export default createRollupConfig('./package.json');
