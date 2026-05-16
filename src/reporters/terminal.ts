import type { ValidationResult } from '../types.js'

// chalk v5 is ESM-only, dynamic import used for CJS compat
async function getChalk() {
  const { default: chalk } = await import('chalk')
  return chalk
}

function relativePath(p: string): string {
  return p.replace(process.cwd() + '/', '')
}

export async function terminalReport(result: ValidationResult): Promise<void> {
  const chalk = await getChalk()

  console.log()
  console.log(chalk.bold('config-sentinel') + ' 🛡️  v0.1.0')
  console.log(chalk.dim('─────────────────────────────────────────'))

  // Sources
  console.log(chalk.bold('Sources scanned:'))
  for (const src of result.sources) {
    const icon = chalk.green('✓')
    const p = chalk.cyan(src.path.padEnd(30))
    const count = chalk.dim(`(${src.keyCount} keys)`)
    console.log(`  ${icon} ${p} ${count}`)
  }

  const totalFiles = result.sources.length
  console.log()
  console.log(
    chalk.dim(`Codebase scanned: ${totalFiles} source${totalFiles !== 1 ? 's' : ''} — `) +
    chalk.dim(`${result.valid.length + result.missing.length} config references found`),
  )

  console.log(chalk.dim('─────────────────────────────────────────'))

  // Missing keys
  if (result.missing.length > 0) {
    console.log()
    console.log(chalk.red.bold(`❌ MISSING KEYS (${result.missing.length})`))
    console.log()
    for (const { key, usedIn } of result.missing) {
      console.log(`  ${chalk.bold.white(key)}`)
      for (const { file, line } of usedIn) {
        console.log(`    └─ used in: ${chalk.cyan(relativePath(file))}${chalk.dim(`:${line}`)}`)
      }
      console.log(`    └─ ${chalk.red('not found in any config source')}`)
      console.log()
    }
  }

  // Unused keys
  if (result.unused.length > 0) {
    console.log()
    console.log(chalk.yellow.bold(`⚠️  UNUSED KEYS (${result.unused.length})`))
    console.log()
    for (const { key, definedIn } of result.unused) {
      console.log(`  ${chalk.bold.white(key)}`)
      console.log(`    └─ defined in: ${chalk.cyan(relativePath(definedIn))}`)
      console.log(`    └─ ${chalk.yellow('never referenced in codebase')}`)
      console.log()
    }
  }

  if (result.missing.length === 0 && result.unused.length === 0) {
    console.log()
    console.log(chalk.green.bold('✅ All config keys are valid and used'))
  }

  console.log(chalk.dim('─────────────────────────────────────────'))

  if (result.missing.length > 0) {
    console.log(chalk.red.bold(`Result: ❌ FAIL — ${result.missing.length} missing key${result.missing.length !== 1 ? 's' : ''} found`))
  } else if (result.unused.length > 0) {
    console.log(chalk.yellow.bold(`Result: ⚠️  PASS with warnings — ${result.unused.length} unused key${result.unused.length !== 1 ? 's' : ''}`))
  } else {
    console.log(chalk.green.bold('Result: ✅ PASS'))
  }
  console.log()
}
