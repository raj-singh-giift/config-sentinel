import { describe, it, expect } from 'vitest'
import { validate } from '../src/core/validator.js'
import type { ConfigKey, UsedKey, SentinelConfig } from '../src/types.js'

const emptyConfig: SentinelConfig = { sources: [] }

describe('validator', () => {
  it('marks key as missing when used but not defined', () => {
    const defined: ConfigKey[] = [{ key: 'DB_HOST', source: '.env' }]
    const used: UsedKey[] = [
      { key: 'DB_HOST', file: 'src/app.ts', line: 5 },
      { key: 'DB_PASSWORD', file: 'src/app.ts', line: 6 },
    ]
    const result = validate(defined, used, [{ path: '.env', keyCount: 1 }], emptyConfig)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0].key).toBe('DB_PASSWORD')
    expect(result.missing[0].usedIn[0].line).toBe(6)
  })

  it('marks key as unused when defined but not used', () => {
    const defined: ConfigKey[] = [
      { key: 'DB_HOST', source: '.env' },
      { key: 'LEGACY_KEY', source: '.env' },
    ]
    const used: UsedKey[] = [{ key: 'DB_HOST', file: 'src/app.ts', line: 1 }]
    const result = validate(defined, used, [{ path: '.env', keyCount: 2 }], emptyConfig)
    expect(result.unused).toHaveLength(1)
    expect(result.unused[0].key).toBe('LEGACY_KEY')
  })

  it('returns empty missing array when all keys exist', () => {
    const defined: ConfigKey[] = [
      { key: 'DB_HOST', source: '.env' },
      { key: 'DB_PORT', source: '.env' },
    ]
    const used: UsedKey[] = [
      { key: 'DB_HOST', file: 'src/app.ts', line: 1 },
      { key: 'DB_PORT', file: 'src/app.ts', line: 2 },
    ]
    const result = validate(defined, used, [{ path: '.env', keyCount: 2 }], emptyConfig)
    expect(result.missing).toHaveLength(0)
  })

  it('resolves accessor-prefixed keys correctly', () => {
    const config: SentinelConfig = {
      sources: [{ type: 'js', path: 'config/database.js', accessor: 'config.db' }],
    }
    const defined: ConfigKey[] = [
      { key: 'host', source: 'config/database.js' },
      { key: 'port', source: 'config/database.js' },
    ]
    const used: UsedKey[] = [
      { key: 'config.db.host', file: 'src/app.ts', line: 5 },
      { key: 'config.db.password', file: 'src/app.ts', line: 6 },
    ]
    const result = validate(defined, used, [{ path: 'config/database.js', keyCount: 2 }], config)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0].key).toBe('config.db.password')
  })
})
