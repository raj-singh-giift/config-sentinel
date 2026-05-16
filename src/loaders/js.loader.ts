import { readFileSync } from 'fs'
import type { ConfigKey } from '../types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenObjectNode(node: any, prefix: string, source: string, SyntaxKind: any): ConfigKey[] {
  const keys: ConfigKey[] = []
  if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return keys

  for (const prop of node.getProperties()) {
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
      const name = prop.getName()
      const fullKey = prefix ? `${prefix}.${name}` : name
      const init = prop.getInitializer()
      if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
        keys.push(...flattenObjectNode(init, fullKey, source, SyntaxKind))
      } else {
        keys.push({ key: fullKey, source, line: prop.getStartLineNumber() })
      }
    } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      const name = prop.getName()
      const fullKey = prefix ? `${prefix}.${name}` : name
      keys.push({ key: fullKey, source, line: prop.getStartLineNumber() })
    }
  }
  return keys
}

function regexFallback(filePath: string, content: string, accessor?: string): ConfigKey[] {
  const keys: ConfigKey[] = []
  const skip = new Set(['module', 'exports', 'require', 'const', 'let', 'var', 'function', 'return', 'if', 'else'])
  const pattern = /^\s{0,4}(\w+)\s*:/gm
  let m: RegExpExecArray | null
  while ((m = pattern.exec(content)) !== null) {
    if (skip.has(m[1])) continue
    const full = accessor ? `${accessor}.${m[1]}` : m[1]
    keys.push({ key: full, source: filePath })
  }
  return keys
}

export async function loadJsFile(filePath: string, accessor?: string): Promise<ConfigKey[]> {
  const content = readFileSync(filePath, 'utf-8')
  const prefix = accessor ?? ''

  try {
    const { Project, SyntaxKind } = await import('ts-morph')
    const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } })
    const src = project.createSourceFile(filePath, content)

    let exportObj = null

    // module.exports = { ... }
    for (const bin of src.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getLeft().getText() === 'module.exports') {
        const right = bin.getRight()
        if (right.getKind() === SyntaxKind.ObjectLiteralExpression) {
          exportObj = right
          break
        }
      }
    }

    // export const x = { ... }
    if (!exportObj) {
      for (const decl of src.getVariableDeclarations()) {
        const init = decl.getInitializer()
        const stmt = decl.getVariableStatement()
        if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression && stmt?.isExported()) {
          exportObj = init
          break
        }
      }
    }

    // export default { ... }
    if (!exportObj) {
      const sym = src.getDefaultExportSymbol()
      if (sym) {
        for (const d of sym.getDeclarations()) {
          if (d.getKind() === SyntaxKind.ObjectLiteralExpression) {
            exportObj = d
            break
          }
        }
      }
    }

    if (exportObj) {
      return flattenObjectNode(exportObj, prefix, filePath, SyntaxKind)
    }
    return regexFallback(filePath, content, accessor)
  } catch {
    return regexFallback(filePath, content, accessor)
  }
}
