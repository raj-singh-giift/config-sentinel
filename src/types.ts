export type ConfigSourceType = 'env' | 'json' | 'js' | 'ts'

export interface ConfigSource {
  type: ConfigSourceType
  path: string
  accessor?: string
}

export interface ConfigKey {
  key: string
  source: string
  value?: string
  line?: number
}

export interface UsedKey {
  key: string
  file: string
  line: number
}

export interface ValidationResult {
  missing: Array<{ key: string; usedIn: Array<{ file: string; line: number }> }>
  unused: Array<{ key: string; definedIn: string }>
  valid: string[]
  sources: Array<{ path: string; keyCount: number }>
}

export interface SentinelConfig {
  sources: (string | ConfigSource)[]
  scan?: string[]
  ignore?: string[]
  accessors?: Record<string, string>
  onMissing?: 'throw' | 'warn' | 'ignore'
  required?: string[]
  /** Extra variable names to treat as config roots (in addition to built-ins: config, cfg, conf, appConfig, settings) */
  configRoots?: string[]
  rules?: {
    missingKey?: 'error' | 'warn' | 'off'
    unusedKey?: 'error' | 'warn' | 'off'
    secretInNonEnv?: 'error' | 'warn' | 'off'
  }
}

export class SentinelError extends Error {
  constructor(
    message: string,
    public readonly missingKeys: string[],
  ) {
    super(message)
    this.name = 'SentinelError'
  }
}
