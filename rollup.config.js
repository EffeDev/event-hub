// Base Rollup configuration for all packages
import { readFileSync } from 'fs';

import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import nodePolyfills from 'rollup-plugin-node-polyfills';

// Helper function to create a RegExp for external dependencies
const startsWithRegExp = (str) => RegExp(`^${str}`);

// Function to create a standard rollup config for packages
export function createRollupConfig(pkgPath = './package.json') {
  const pkg = JSON.parse(readFileSync(pkgPath));

  // TypeScript plugin configuration with explicit options
  const typescriptPlugin = typescript({
    outputToFilesystem: true,
    sourceMap: true,
  });

  return [
    {
      input: 'src/index.ts',
      output: [
        {
          name: pkg.name.split('/').pop(),
          file: pkg.browser,
          format: 'umd',
          plugins: [terser()],
          sourcemap: true,
        },
        {
          name: pkg.name.split('/').pop(),
          file: `${pkg.browser.replace(/\.min\.js$/, '.js')}`,
          format: 'umd',
          sourcemap: true,
        },
      ],
      plugins: [
        commonjs(), 
        nodePolyfills(), 
        nodeResolve({ browser: true, preferBuiltins: false }), 
        typescriptPlugin
      ],
    },
    {
      input: 'src/index.ts',
      external: [
        ...Object.keys(pkg.dependencies || {}).map(startsWithRegExp),
        // ...Object.keys(pkg.peerDependencies || {}).map(startsWithRegExp),
      ],
      plugins: [commonjs(), typescriptPlugin],
      output: [
        { file: pkg.main, format: 'cjs', sourcemap: true },
        { file: pkg.module, format: 'es', sourcemap: true },
      ],
    },
  ];
}

// Default export for direct usage
export default createRollupConfig();
