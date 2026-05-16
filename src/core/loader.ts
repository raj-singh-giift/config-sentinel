import { existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'
import type { ConfigKey, ConfigSource, SentinelConfig } from '../types.js'
import { loadEnvFile } from '../loaders/env.loader.js'
import { loadJsonFile } from '../loaders/json.loader.js'
import { loadJsFile } from '../loaders/js.loader.js'

function extType(p: string): 'env' | 'json' | 'js' | 'ts' {
  if (p.match(/\.env(\.\w+)?$/) || p.endsWith('.env')) return 'env'
  if (p.endsWith('.json')) return 'json'
  if (p.endsWith('.ts')) return 'ts'
  return 'js'
}

function normalizeSource(s: string | ConfigSource): ConfigSource {
  if (typeof s === 'string') {
    return { type: extType(s), path: s }
  }
  return s
}

async function loadSource(source: ConfigSource, cwd: string): Promise<ConfigKey[]> {
  const fullPath = source.path.startsWith('/') ? source.path : join(cwd, source.path)

  if (!existsSync(fullPath)) {
    console.warn(`[config-sentinel] source not found: ${fullPath}`)
    return []
  }

  try {
    switch (source.type) {
      case 'env':
        return loadEnvFile(fullPath)
      case 'json':
        return loadJsonFile(fullPath, source.accessor)
      case 'js':
      case 'ts':
        return loadJsFile(fullPath, source.accessor)
    }
  } catch (err) {
    console.warn(`[config-sentinel] failed to load ${fullPath}: ${(err as Error).message}`)
    return []
  }
}

async function autoDetectSources(cwd: string): Promise<ConfigSource[]> {
  const sources: ConfigSource[] = []

  const envFiles = await glob('.env*', { cwd, dot: true, nodir: true })
  for (const f of envFiles) {
    sources.push({ type: 'env', path: f })
  }

  const configFiles = await glob('config/**/*.{js,ts,json}', { cwd, nodir: true })
  for (const f of configFiles) {
    sources.push({ type: extType(f), path: f })
  }

  return sources
}

export interface SourceMeta {
  path: string
  keyCount: number
}

export async function loadAllSources(
  config: SentinelConfig,
  cwd = process.cwd(),
): Promise<{ keys: ConfigKey[]; sourceMeta: SourceMeta[] }> {
  let rawSources = config.sources

  if (!rawSources || rawSources.length === 0) {
    rawSources = await autoDetectSources(cwd)
  }

  const normalized = rawSources.map(normalizeSource)
  const sourceMeta: SourceMeta[] = []
  const allKeys: ConfigKey[] = []

  for (const source of normalized) {
    const keys = await loadSource(source, cwd)
    // Deduplicate keys within the same file
    const seen = new Set<string>()
    const deduped: ConfigKey[] = []
    for (const k of keys) {
      if (!seen.has(k.key)) {
        seen.add(k.key)
        deduped.push(k)
      }
    }
    sourceMeta.push({ path: source.path, keyCount: deduped.length })
    allKeys.push(...deduped)
  }

  return { keys: allKeys, sourceMeta }
}
