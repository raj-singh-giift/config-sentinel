#!/usr/bin/env node
import { program } from 'commander'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { runCheck } from './commands/check.js'
import { runGenerate } from './commands/generate.js'

const DEFAULT_SENTINEL_CONFIG = `module.exports = {
  sources: [
    '.env',
    // { type: 'js', path: 'config/database.js', accessor: 'config.db' },
    // { type: 'ts', path: 'config/redis.config.ts', accessor: 'config.redis' },
    // { type: 'json', path: 'config/app.json', accessor: 'config.app' },
  ],
  scan: ['src'],
  ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  rules: {
    missingKey: 'error',
    unusedKey: 'warn',
    secretInNonEnv: 'warn',
  },
}
`

program
  .name('config-sentinel')
  .description('Validate config sources and catch missing keys before production')
  .version('0.1.0')

program
  .command('check')
  .description('Scan codebase for missing or unused config keys')
  .option('--sources <paths>', 'comma-separated config source paths')
  .option('--scan <dirs>', 'comma-separated dirs to scan for usage (default: src)')
  .option('--format <type>', 'output format: terminal|json (default: terminal)')
  .option('--config <path>', 'path to sentinel.config.js')
  .option('--fail-on-warn', 'exit code 2 on warnings (unused keys)')
  .action(runCheck)

program
  .command('generate-types')
  .description('Generate TypeScript .d.ts from your config sources')
  .option('--out <path>', 'output path for .d.ts file (default: config.d.ts)')
  .option('--name <name>', 'interface name (default: AppConfig)')
  .action(runGenerate)

program
  .command('init')
  .description('Create a sentinel.config.js in current directory')
  .action(async () => {
    const out = resolve(process.cwd(), 'sentinel.config.js')
    await writeFile(out, DEFAULT_SENTINEL_CONFIG, 'utf-8')
    console.log(`[config-sentinel] Created ${out}`)
  })

program.parse()
