import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/sentinel.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  shims: true,
})
