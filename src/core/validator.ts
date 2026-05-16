import type { ConfigKey, SentinelConfig, UsedKey, ValidationResult } from '../types.js'
import type { SourceMeta } from './loader.js'

function buildAccessorMap(config: SentinelConfig): Map<string, string> {
  const map = new Map<string, string>()
  if (!config.sources) return map
  for (const s of config.sources) {
    if (typeof s !== 'string' && s.accessor) {
      map.set(s.accessor, s.path)
    }
  }
  return map
}

// Returns the fully-qualified key for a defined key, applying accessor prefix if needed.
// Guards against double-prefixing when the loader has already applied the accessor.
function expandDefinedKey(dk: ConfigKey, accessorMap: Map<string, string>): string {
  for (const [accessor, sourcePath] of accessorMap) {
    const sourceMatches = dk.source === sourcePath || dk.source.endsWith(`/${sourcePath}`)
    if (!sourceMatches) continue
    // If the key already starts with the accessor prefix, don't double-expand
    if (dk.key.startsWith(`${accessor}.`)) return dk.key
    return `${accessor}.${dk.key}`
  }
  return dk.key
}

function usedKeyMatchesDefined(usedKey: string, dk: ConfigKey, accessorMap: Map<string, string>): boolean {
  // Direct match first (handles loader-prefixed keys)
  if (dk.key === usedKey) return true

  // Accessor expansion (handles raw keys from loaders that didn't apply prefix)
  const expanded = expandDefinedKey(dk, accessorMap)
  return expanded === usedKey
}

export function validate(
  definedKeys: ConfigKey[],
  usedKeys: UsedKey[],
  sourceMeta: SourceMeta[],
  config: SentinelConfig,
): ValidationResult {
  const accessorMap = buildAccessorMap(config)

  // Build full set of resolvable defined keys (both raw and accessor-expanded)
  const resolvableKeys = new Set<string>()
  // Also store all prefixes so parent-object access (config.stripe.recharge as any).x
  // doesn't show as missing when the parent object IS defined (has child keys).
  const resolvablePrefixes = new Set<string>()
  for (const dk of definedKeys) {
    resolvableKeys.add(dk.key)
    const expanded = expandDefinedKey(dk, accessorMap)
    resolvableKeys.add(expanded)
    // Add all ancestor prefixes of each defined key
    const parts = expanded.split('.')
    for (let i = 1; i < parts.length; i++) {
      resolvablePrefixes.add(parts.slice(0, i).join('.'))
    }
  }

  // Find missing: used but not resolvable as a leaf key OR as a parent-object prefix
  const missingMap = new Map<string, Array<{ file: string; line: number }>>()
  for (const uk of usedKeys) {
    if (!resolvableKeys.has(uk.key) && !resolvablePrefixes.has(uk.key)) {
      const existing = missingMap.get(uk.key) ?? []
      existing.push({ file: uk.file, line: uk.line })
      missingMap.set(uk.key, existing)
    }
  }

  // Build set of all used key strings for fast prefix checking
  const usedKeyStrings = new Set(usedKeys.map((uk) => uk.key))

  // Find unused: defined but never matched by any used key
  // A defined key is NOT unused if:
  //   1. It is directly used, OR
  //   2. A parent-object prefix of it is used (e.g. config.db used, so config.db.host is not unused)
  const unusedList: Array<{ key: string; definedIn: string }> = []
  for (const dk of definedKeys) {
    const expandedKey = expandDefinedKey(dk, accessorMap)
    const isUsed = usedKeys.some((uk) => usedKeyMatchesDefined(uk.key, dk, accessorMap))
    if (isUsed) continue

    // Check if any ancestor prefix of this key is used
    const parts = expandedKey.split('.')
    const parentUsed = parts.some((_, i) => {
      if (i === 0) return false
      return usedKeyStrings.has(parts.slice(0, i).join('.'))
    })
    if (parentUsed) continue

    unusedList.push({ key: expandedKey, definedIn: dk.source })
  }

  // Valid: used keys that resolved
  const validKeys: string[] = []
  const missingSet = new Set(missingMap.keys())
  for (const uk of usedKeys) {
    if (!missingSet.has(uk.key) && !validKeys.includes(uk.key)) {
      validKeys.push(uk.key)
    }
  }

  return {
    missing: Array.from(missingMap.entries()).map(([key, usedIn]) => ({ key, usedIn })),
    unused: unusedList,
    valid: validKeys,
    sources: sourceMeta,
  }
}
