import { describe, it, expect } from 'vitest'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { scanCodebase } from '../src/core/scanner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP = join(__dirname, '__scan_tmp__')
const SRC = join(TMP, 'src')

function setup() {
  mkdirSync(SRC, { recursive: true })
}
function teardown() {
  rmSync(TMP, { recursive: true, force: true })
}

describe('scanner', () => {
  it('detects process.env.KEY pattern', async () => {
    setup()
    writeFileSync(join(SRC, 'app.ts'), `const h = process.env.DB_HOST\n`)
    const keys = await scanCodebase(['src'], TMP)
    const found = keys.find((k) => k.key === 'DB_HOST')
    expect(found).toBeDefined()
    expect(found?.file).toContain('app.ts')
    teardown()
  })

  it('detects config.x.y pattern', async () => {
    setup()
    writeFileSync(join(SRC, 'app.ts'), `const h = config.db.host\n`)
    const keys = await scanCodebase(['src'], TMP)
    const found = keys.find((k) => k.key === 'config.db.host')
    expect(found).toBeDefined()
    teardown()
  })

  it('detects destructuring: const { x } = config.db', async () => {
    setup()
    writeFileSync(join(SRC, 'app.ts'), `const { host, port } = config.db\n`)
    const keys = await scanCodebase(['src'], TMP)
    const keyNames = keys.map((k) => k.key)
    expect(keyNames).toContain('config.db.host')
    expect(keyNames).toContain('config.db.port')
    teardown()
  })

  it('returns correct file and line number', async () => {
    setup()
    writeFileSync(join(SRC, 'service.ts'), `// line 1\nconst x = process.env.SECRET_KEY\n`)
    const keys = await scanCodebase(['src'], TMP)
    const found = keys.find((k) => k.key === 'SECRET_KEY')
    expect(found).toBeDefined()
    expect(found?.line).toBe(2)
    expect(found?.file).toContain('service.ts')
    teardown()
  })
})
