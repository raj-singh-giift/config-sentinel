import { loadAllSources } from './core/loader.js'
import { scanCodebase } from './core/scanner.js'
import { validate } from './core/validator.js'
import { SentinelError } from './types.js'
import type { SentinelConfig, ValidationResult } from './types.js'

export { SentinelError } from './types.js'
export type { SentinelConfig, ValidationResult, ConfigKey, UsedKey, ConfigSource, ConfigSourceType } from './types.js'

export function createSentinel(config: SentinelConfig) {
  return {
    async validate(): Promise<ValidationResult> {
      const cwd = process.cwd()
      const scanDirs = config.scan ?? ['src']

      const { keys: definedKeys, sourceMeta } = await loadAllSources(config, cwd)
      const usedKeys = await scanCodebase(scanDirs, cwd, config.ignore, config.configRoots)
      const result = validate(definedKeys, usedKeys, sourceMeta, config)

      if (result.missing.length > 0) {
        if (config.onMissing === 'throw') {
          throw new SentinelError(
            `config-sentinel: ${result.missing.length} missing config key(s): ${result.missing.map((m) => m.key).join(', ')}`,
            result.missing.map((m) => m.key),
          )
        }

        if (config.onMissing === 'warn') {
          for (const { key, usedIn } of result.missing) {
            const locations = usedIn.map((u) => `${u.file}:${u.line}`).join(', ')
            console.warn(`[config-sentinel] MISSING key "${key}" used at: ${locations}`)
          }
        }
      }

      return result
    },
  }
}
