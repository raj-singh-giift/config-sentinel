import { describe, it, expect } from 'vitest'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadEnvFile } from '../src/loaders/env.loader.js'
import { loadJsonFile } from '../src/loaders/json.loader.js'
import { loadJsFile } from '../src/loaders/js.loader.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP = join(__dirname, '__tmp__')

function setup() {
  mkdirSync(TMP, { recursive: true })
}
function teardown() {
  rmSync(TMP, { recursive: true, force: true })
}

describe('env loader', () => {
  it('parses KEY=value correctly', () => {
    setup()
    const f = join(TMP, '.env')
    writeFileSync(f, 'DB_HOST=localhost\nDB_PORT=3306\n')
    const keys = loadEnvFile(f)
    expect(keys.map((k) => k.key)).toContain('DB_HOST')
    expect(keys.map((k) => k.key)).toContain('DB_PORT')
    expect(keys.find((k) => k.key === 'DB_HOST')?.value).toBe('localhost')
    teardown()
  })

  it('ignores comment lines and blank lines', () => {
    setup()
    const f = join(TMP, '.env')
    writeFileSync(f, '# this is a comment\n\nDB_HOST=localhost\n')
    const keys = loadEnvFile(f)
    expect(keys).toHaveLength(1)
    expect(keys[0].key).toBe('DB_HOST')
    teardown()
  })

  it('handles quoted values', () => {
    setup()
    const f = join(TMP, '.env')
    writeFileSync(f, 'API_KEY="secret value with spaces"\n')
    const keys = loadEnvFile(f)
    expect(keys[0].value).toBe('secret value with spaces')
    teardown()
  })
})

describe('json loader', () => {
  it('flattens nested objects with dot notation', () => {
    setup()
    const f = join(TMP, 'config.json')
    writeFileSync(f, JSON.stringify({ db: { host: 'localhost', port: 5432 } }))
    const keys = loadJsonFile(f)
    expect(keys.map((k) => k.key)).toContain('db.host')
    expect(keys.map((k) => k.key)).toContain('db.port')
    teardown()
  })

  it('applies accessor prefix correctly', () => {
    setup()
    const f = join(TMP, 'config.json')
    writeFileSync(f, JSON.stringify({ host: 'localhost', port: 5432 }))
    const keys = loadJsonFile(f, 'config.db')
    expect(keys.map((k) => k.key)).toContain('config.db.host')
    expect(keys.map((k) => k.key)).toContain('config.db.port')
    teardown()
  })
})

describe('js loader', () => {
  it('extracts keys from module.exports = {}', async () => {
    setup()
    const f = join(TMP, 'config.js')
    writeFileSync(f, "module.exports = { host: 'localhost', port: 3306, name: 'mydb' }\n")
    const keys = await loadJsFile(f)
    const keyNames = keys.map((k) => k.key)
    expect(keyNames).toContain('host')
    expect(keyNames).toContain('port')
    expect(keyNames).toContain('name')
    teardown()
  })

  it('extracts keys from export const config = {}', async () => {
    setup()
    const f = join(TMP, 'config.ts')
    writeFileSync(f, "export const config = { host: 'localhost', port: 6379, ttl: 3600 }\n")
    const keys = await loadJsFile(f)
    const keyNames = keys.map((k) => k.key)
    expect(keyNames).toContain('host')
    expect(keyNames).toContain('ttl')
    teardown()
  })

  it('applies accessor prefix to js loader results', async () => {
    setup()
    const f = join(TMP, 'db.js')
    writeFileSync(f, "module.exports = { host: 'localhost', port: 3306 }\n")
    const keys = await loadJsFile(f, 'config.db')
    const keyNames = keys.map((k) => k.key)
    expect(keyNames).toContain('config.db.host')
    expect(keyNames).toContain('config.db.port')
    teardown()
  })
})
