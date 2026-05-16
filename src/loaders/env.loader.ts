import { readFileSync } from 'fs'
import type { ConfigKey } from '../types.js'

export function loadEnvFile(filePath: string): ConfigKey[] {
  const content = readFileSync(filePath, 'utf-8')
  const keys: ConfigKey[] = []
  const lines = content.split('\n')

  let lineIndex = 0
  let continuationKey: string | null = null
  let continuationValue = ''
  let continuationLine = 0

  while (lineIndex < lines.length) {
    let line = lines[lineIndex]
    lineIndex++

    // Handle backslash continuation
    if (continuationKey !== null) {
      if (line.endsWith('\\')) {
        continuationValue += '\n' + line.slice(0, -1)
        continue
      } else {
        continuationValue += '\n' + line
        keys.push({ key: continuationKey, source: filePath, value: continuationValue.trim(), line: continuationLine })
        continuationKey = null
        continuationValue = ''
        continue
      }
    }

    // Strip inline comments only outside quoted values
    const trimmed = line.trim()

    // Skip empty lines and comment lines
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    let value = trimmed.slice(eqIdx + 1).trim()

    // Quoted value
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else if (value.endsWith('\\')) {
      // Multiline continuation
      continuationKey = key
      continuationValue = value.slice(0, -1)
      continuationLine = lineIndex
      continue
    } else {
      // Strip inline comment
      const commentIdx = value.indexOf(' #')
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim()
      }
    }

    keys.push({ key, source: filePath, value, line: lineIndex })
  }

  // Flush any pending continuation
  if (continuationKey !== null) {
    keys.push({ key: continuationKey, source: filePath, value: continuationValue.trim(), line: continuationLine })
  }

  return keys
}
