import { readFileSync } from 'fs'
import { glob } from 'glob'
import type { UsedKey } from '../types.js'

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.js',
  '**/*.spec.js',
]

// Built-in variable names treated as config roots
const DEFAULT_CONFIG_ROOTS = ['config', 'cfg', 'conf', 'appConfig', 'settings']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveAccessChain(node: any, SyntaxKind: any): string | null {
  const parts: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = node

  while (cur) {
    if (cur.getKind() === SyntaxKind.PropertyAccessExpression) {
      parts.unshift(cur.getName())
      cur = cur.getExpression()
    } else if (cur.getKind() === SyntaxKind.ElementAccessExpression) {
      const arg = cur.getArgumentExpression()
      if (!arg) return null
      if (arg.getKind() === SyntaxKind.StringLiteral) {
        parts.unshift(arg.getLiteralText())
        cur = cur.getExpression()
      } else {
        return null // dynamic key — can't statically resolve
      }
    } else if (cur.getKind() === SyntaxKind.Identifier) {
      parts.unshift(cur.getText())
      break
    } else {
      break
    }
  }

  return parts.length >= 2 ? parts.join('.') : null
}

// Returns true if this node is an intermediate node in a longer access chain.
// e.g. `config.aws` inside `config.aws.sqs.queueUrl` — skip it; the leaf captures it.
// Exception: if the parent chain ends in a method call (e.g. config.arr.includes()),
// this node IS the last meaningful config access and should NOT be skipped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isIntermediateAccess(node: any, SyntaxKind: any): boolean {
  const parent = node.getParent()
  if (!parent) return false
  const pk = parent.getKind()
  if (pk === SyntaxKind.PropertyAccessExpression || pk === SyntaxKind.ElementAccessExpression) {
    // If the parent is the callee of a CallExpression, then the parent is a method call.
    // That means THIS node is the receiver object — it IS meaningful, don't skip.
    const grandParent = parent.getParent()
    if (
      grandParent &&
      grandParent.getKind() === SyntaxKind.CallExpression &&
      grandParent.getExpression?.() === parent
    ) {
      return false
    }
    return true
  }
  return false
}

// Returns true if this node is the callee of a call expression (i.e., config.arr.includes(...))
// In that case the last segment is a method name, not a config key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMethodCall(node: any, SyntaxKind: any): boolean {
  const parent = node.getParent()
  if (!parent) return false
  return parent.getKind() === SyntaxKind.CallExpression && parent.getExpression?.() === node
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromSourceFile(sourceFile: any, filePath: string, SyntaxKind: any, configRoots: Set<string>): UsedKey[] {
  const keys: UsedKey[] = []

  // --- Pattern 1: process.env.KEY and process.env['KEY'] ---
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const expr = node.getExpression()
    if (
      expr.getKind() === SyntaxKind.PropertyAccessExpression &&
      expr.getText() === 'process.env'
    ) {
      if (isIntermediateAccess(node, SyntaxKind)) continue
      keys.push({ key: node.getName(), file: filePath, line: node.getStartLineNumber() })
    }
  }

  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
    const expr = node.getExpression()
    if (expr.getText() === 'process.env') {
      const arg = node.getArgumentExpression()
      if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
        keys.push({ key: arg.getLiteralText(), file: filePath, line: node.getStartLineNumber() })
      }
    }
  }

  // --- Pattern 2 & 4: config.x.y (2+ levels) via PropertyAccessExpression chains ---
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    // Skip intermediate nodes — only capture leaf accesses
    if (isIntermediateAccess(node, SyntaxKind)) continue
    // Skip method calls — config.arr.includes(...) should not produce key "config.arr.includes"
    if (isMethodCall(node, SyntaxKind)) continue

    const chain = resolveAccessChain(node, SyntaxKind)
    if (!chain) continue
    const parts = chain.split('.')
    // Require root to be a known config variable, and at least 2-level access (config.key)
    if (parts.length >= 2 && configRoots.has(parts[0])) {
      keys.push({ key: chain, file: filePath, line: node.getStartLineNumber() })
    }
  }

  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
    if (isIntermediateAccess(node, SyntaxKind)) continue
    const chain = resolveAccessChain(node, SyntaxKind)
    if (!chain) continue
    const parts = chain.split('.')
    if (parts.length >= 2 && configRoots.has(parts[0])) {
      keys.push({ key: chain, file: filePath, line: node.getStartLineNumber() })
    }
  }

  // --- Pattern 3: const { host, port } = config.db ---
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = node.getNameNode()
    if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue

    const init = node.getInitializer()
    if (!init) continue

    let prefix: string | null = null
    if (init.getKind() === SyntaxKind.PropertyAccessExpression) {
      const chain = resolveAccessChain(init, SyntaxKind)
      if (chain) {
        const parts = chain.split('.')
        // Only treat as config destructuring if root is a known config variable
        if (configRoots.has(parts[0])) prefix = chain
      }
    } else if (init.getKind() === SyntaxKind.Identifier) {
      const name = init.getText()
      if (configRoots.has(name)) prefix = name
    }

    if (!prefix) continue

    for (const element of nameNode.getElements()) {
      const propName = element.getPropertyNameNode()?.getText() ?? element.getName()
      keys.push({ key: `${prefix}.${propName}`, file: filePath, line: node.getStartLineNumber() })
    }
  }

  // --- process.env destructuring: const { DB_HOST } = process.env ---
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = node.getNameNode()
    if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue

    const init = node.getInitializer()
    if (!init || init.getText() !== 'process.env') continue

    for (const element of nameNode.getElements()) {
      const propName = element.getPropertyNameNode()?.getText() ?? element.getName()
      keys.push({ key: propName, file: filePath, line: node.getStartLineNumber() })
    }
  }

  return keys
}

function deduplicateKeys(keys: UsedKey[]): UsedKey[] {
  const seen = new Set<string>()
  return keys.filter((k) => {
    const id = `${k.key}:${k.file}:${k.line}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export async function scanCodebase(
  scanDirs: string[],
  cwd = process.cwd(),
  ignorePatterns: string[] = [],
  extraConfigRoots: string[] = [],
): Promise<UsedKey[]> {
  const configRoots = new Set([...DEFAULT_CONFIG_ROOTS, ...extraConfigRoots])
  const ignore = [...DEFAULT_IGNORE, ...ignorePatterns]
  const patterns = scanDirs.map((d) => `${d}/**/*.{ts,tsx,js,jsx}`)

  const files = await glob(patterns, { cwd, ignore, absolute: true, nodir: true })
  if (files.length === 0) return []

  const { Project, SyntaxKind } = await import('ts-morph')
  const project = new Project({
    useInMemoryFileSystem: false,
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  })

  const allKeys: UsedKey[] = []

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      let sourceFile = project.getSourceFile(file)
      if (!sourceFile) {
        sourceFile = project.createSourceFile(file, content, { overwrite: true })
      }
      allKeys.push(...extractFromSourceFile(sourceFile, file, SyntaxKind, configRoots))
    } catch {
      // Skip unparseable files silently
    }
  }

  return deduplicateKeys(allKeys)
}
