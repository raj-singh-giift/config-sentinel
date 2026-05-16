import { readFileSync } from 'fs'
import type { ConfigKey } from '../types.js'

function flattenObject(obj: Record<string, unknown>, prefix: string, source: string): ConfigKey[] {
  const keys: ConfigKey[] = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenObject(v as Record<string, unknown>, fullKey, source))
    } else {
      keys.push({ key: fullKey, source, value: String(v ?? '') })
    }
  }
  return keys
}

export function loadJsonFile(filePath: string, accessor?: string): ConfigKey[] {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(content) as Record<string, unknown>
  const prefix = accessor ?? ''
  return flattenObject(parsed, prefix, filePath)
}
