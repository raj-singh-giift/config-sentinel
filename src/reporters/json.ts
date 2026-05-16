import type { ValidationResult } from '../types.js'

export function jsonReport(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2))
}
