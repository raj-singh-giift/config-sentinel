# config-sentinel 🛡️

Catch missing config keys **before production** — not after the crash.

Statically scans your codebase for every `process.env.KEY` and `config.x.y` reference, cross-checks against your actual config sources, and reports anything missing or unused. Runs in CI as a CLI or at app startup as a library.

```
❌ MISSING KEYS (2)

  config.redis.cluster
    └─ used in: src/cache/redis.ts:8
    └─ not found in any config source

  DB_PASSWORD
    └─ used in: src/db/connection.ts:14
    └─ not found in any config source

Result: ❌ FAIL — 2 missing keys found
```

---

## Install

```bash
npm install --save-dev config-sentinel
# or use directly without installing
npx config-sentinel check
```

---

## Quick start

```bash
# 1. Generate a config file
npx config-sentinel init

# 2. Edit sentinel.config.js to point at your sources
# 3. Run the check
npx config-sentinel check
```

---

## CLI

### `check`

Scans your codebase and reports missing/unused keys.

```bash
npx config-sentinel check [options]
```

| Option | Description | Default |
|---|---|---|
| `--config <path>` | Path to `sentinel.config.js` | auto-detect |
| `--sources <paths>` | Comma-separated source paths | from config file |
| `--scan <dirs>` | Comma-separated dirs to scan | `src` |
| `--format <type>` | `terminal` or `json` | `terminal` |
| `--fail-on-warn` | Exit code 2 on unused key warnings | off |

**Exit codes:**
- `0` — all keys valid
- `1` — missing keys found (error)
- `2` — warnings only, with `--fail-on-warn`

**Examples:**

```bash
# Use a config file
npx config-sentinel check --config sentinel.config.js

# Inline sources and scan dirs
npx config-sentinel check --sources ".env,config/database.js" --scan "src,lib"

# JSON output for CI parsing
npx config-sentinel check --format json | jq '.missing[].key'
```

### `generate-types`

Generates a TypeScript `.d.ts` interface from your config shape.

```bash
npx config-sentinel generate-types --out src/config.d.ts --name AppConfig
```

Output example:

```ts
export interface AppConfig {
  DB_HOST: string
  DB_PORT: string
  config: {
    db: {
      host: string
      port: string
    }
    redis: {
      host: string
      ttl: string
    }
  }
}
```

### `init`

Creates a `sentinel.config.js` in the current directory.

```bash
npx config-sentinel init
```

---

## Configuration

`sentinel.config.js`:

```js
module.exports = {
  sources: [
    '.env',
    { type: 'js', path: 'config/database.js', accessor: 'config.db' },
    { type: 'ts', path: 'config/redis.config.ts', accessor: 'config.redis' },
    { type: 'json', path: 'config/app.json', accessor: 'config.app' },
  ],

  scan: ['src'],

  ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

  // Extra variable names to treat as config roots, in addition to the built-ins:
  // config, cfg, conf, appConfig, settings
  // Use this when your codebase imports config under a non-standard name.
  configRoots: ['myConfig'],

  rules: {
    missingKey: 'error',   // 'error' | 'warn' | 'off'
    unusedKey: 'warn',
    secretInNonEnv: 'warn',
  },
}
```

### `accessor` — the key concept

When your code does `config.db.host`, sentinel needs to know that `host` from `config/database.js` maps to `config.db.host` at runtime. The `accessor` field declares that mapping.

```js
// config/database.js exports:
module.exports = { host: 'localhost', port: 3306 }

// Your code uses:
const { host } = config.db   // → config.db.host
const port = config.db.port  // → config.db.port

// sentinel.config.js:
{ type: 'js', path: 'config/database.js', accessor: 'config.db' }
//                                                    ↑
//                          "host" from the file becomes "config.db.host" in analysis
```

Without an `accessor`, sentinel treats the file's keys as top-level.

---

## Library API

Use at app startup to catch missing keys before the server accepts traffic.

```ts
import { createSentinel } from 'config-sentinel'

const sentinel = createSentinel({
  sources: [
    '.env',
    { type: 'js', path: 'config/database.js', accessor: 'config.db' },
  ],
  scan: ['src'],
  onMissing: 'throw', // or 'warn' | 'ignore'
})

await sentinel.validate()
// throws SentinelError if any key is missing and onMissing === 'throw'
```

### `createSentinel(config)`

Returns an object with a single `validate()` method.

```ts
interface SentinelConfig {
  sources: (string | ConfigSource)[]
  scan?: string[]                    // default: ['src']
  ignore?: string[]                  // glob patterns to skip
  configRoots?: string[]             // extra config variable names to track
  onMissing?: 'throw' | 'warn' | 'ignore'  // default: 'ignore'
  required?: string[]                // keys that must exist regardless of usage
  rules?: {
    missingKey?: 'error' | 'warn' | 'off'
    unusedKey?: 'error' | 'warn' | 'off'
    secretInNonEnv?: 'error' | 'warn' | 'off'
  }
}
```

### `SentinelError`

Thrown when `onMissing: 'throw'` and missing keys are found.

```ts
import { createSentinel, SentinelError } from 'config-sentinel'

try {
  await sentinel.validate()
} catch (err) {
  if (err instanceof SentinelError) {
    console.error('Missing keys:', err.missingKeys)
    process.exit(1)
  }
}
```

---

## Detection patterns

Sentinel detects these access patterns via AST analysis:

```ts
// process.env access
process.env.DB_HOST           // → key: DB_HOST
process.env['DB_HOST']        // → key: DB_HOST

// Object property chains (2+ levels deep)
config.port                   // → key: config.port
config.db.host                // → key: config.db.host
config.db.replica.host        // → key: config.db.replica.host

// Destructuring
const { host, port } = config.db    // → config.db.host, config.db.port
const { DB_HOST } = process.env     // → DB_HOST

// Bracket notation
config['db']['host']          // → key: config.db.host
```

String literals that look like config paths are **not** flagged — only actual runtime property access.

---

## CI integration

Add to your pipeline before deploy:

```yaml
# GitHub Actions
- name: Check config keys
  run: npx config-sentinel check --format json
```

```bash
# Pre-deploy script
config-sentinel check || exit 1
```

---

## Source types

| Extension | Auto-detected type | Notes |
|---|---|---|
| `.env`, `.env.*` | `env` | Custom parser, no dotenv dep |
| `.json` | `json` | Flattened to dot-notation |
| `.js` | `js` | ts-morph AST + regex fallback |
| `.ts` | `ts` | ts-morph AST + regex fallback |

---

## How it works

1. **Load** — reads all config sources, flattens nested keys to dot-notation with accessor prefixes applied
2. **Scan** — traverses AST of every `.ts`/`.js` file in scan dirs, records every config access with file + line number
3. **Validate** — cross-references the two sets; reports keys that appear in code but not in any source (missing) and keys defined but never read (unused)
4. **Report** — terminal output with chalk colours or JSON for machines

---

## Known limitations

**Type cast breaks chain detection**

```ts
(config.redis as any).cluster  // only "config.redis" detected, not ".cluster"
```

The `as any` / `as Type` cast interrupts the AST chain. Sentinel detects `config.redis` (the receiver) but not the property accessed after the cast. Use typed access or a helper to avoid this.

**Same config imported under different names**

```ts
// file-a.ts
const config = require('./config')   // → config.db.host

// file-b.ts
const cfg = require('./config')      // → cfg.db.host  ← NOT matched
```

If the same config file is imported with different variable names, the accessed keys won't match the defined keys. Add all aliases to `configRoots` and use a single consistent `accessor` matching the most common name. Better: standardize the import name across the codebase.

**Dynamic keys not resolved**

```ts
const key = 'host'
config.db[key]   // ← not detected (runtime key)
```

Only static string literals in bracket notation are resolved.

---

## Requirements

- Node.js ≥ 18
- Works with TypeScript and JavaScript codebases

---

## License

MIT
