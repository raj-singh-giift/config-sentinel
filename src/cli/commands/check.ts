import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { loadAllSources } from '../../core/loader.js'
import { scanCodebase } from '../../core/scanner.js'
import { validate } from '../../core/validator.js'
import { terminalReport } from '../../reporters/terminal.js'
import { jsonReport } from '../../reporters/json.js'
import type { SentinelConfig } from '../../types.js'

interface CheckOptions {
  sources?: string
  scan?: string
  format?: string
  config?: string
  failOnWarn?: boolean
}

async function loadConfig(configPath: string | undefined, cwd: string): Promise<SentinelConfig | null> {
  const candidates = configPath
    ? [resolve(configPath)]
    : [
        join(cwd, 'sentinel.config.js'),
        join(cwd, 'sentinel.config.cjs'),
        join(cwd, 'sentinel.config.mjs'),
      ]

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        // Dynamic require/import for config file
        const mod = await import(p)
        return (mod.default ?? mod) as SentinelConfig
      } catch {
        console.warn(`[config-sentinel] failed to load config: ${p}`)
      }
    }
  }
  return null
}

export async function runCheck(options: CheckOptions): Promise<void> {
  const cwd = process.cwd()

  // Load file config
  let fileConfig: SentinelConfig = { sources: [] }
  const loaded = await loadConfig(options.config, cwd)
  if (loaded) fileConfig = loaded

  // CLI flags override file config
  const sources = options.sources
    ? options.sources.split(',').map((s) => s.trim())
    : fileConfig.sources ?? []

  const scan = options.scan
    ? options.scan.split(',').map((s) => s.trim())
    : fileConfig.scan ?? ['src']

  const format = options.format ?? 'terminal'

  const sentinelConfig: SentinelConfig = {
    ...fileConfig,
    sources,
    scan,
  }

  // Load all config sources
  const { keys: definedKeys, sourceMeta } = await loadAllSources(sentinelConfig, cwd)

  // Scan codebase for usage
  const usedKeys = await scanCodebase(scan, cwd, fileConfig.ignore, fileConfig.configRoots)

  // Validate
  const result = validate(definedKeys, usedKeys, sourceMeta, sentinelConfig)

  // Report
  if (format === 'json') {
    jsonReport(result)
  } else {
    await terminalReport(result)
  }

  // Exit code
  if (result.missing.length > 0) {
    process.exit(1)
  }
  if (options.failOnWarn && result.unused.length > 0) {
    process.exit(2)
  }
  process.exit(0)
}
