import { resolve } from 'path'
import { loadAllSources } from '../../core/loader.js'
import { writeTypes } from '../../core/typegen.js'
import type { SentinelConfig } from '../../types.js'

interface GenerateOptions {
  out?: string
  name?: string
}

export async function runGenerate(options: GenerateOptions): Promise<void> {
  const cwd = process.cwd()
  const outPath = resolve(options.out ?? 'config.d.ts')
  const name = options.name ?? 'AppConfig'

  // Try to load sentinel config
  let config: SentinelConfig = { sources: [] }
  try {
    const p = resolve(cwd, 'sentinel.config.js')
    const mod = await import(p)
    config = mod.default ?? mod
  } catch {
    // use empty sources, auto-detect will kick in
  }

  const { keys } = await loadAllSources(config, cwd)
  await writeTypes(keys, outPath, name)
  console.log(`[config-sentinel] Generated types → ${outPath}`)
}
