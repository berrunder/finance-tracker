/**
 * Simple arithmetic expression evaluator supporting +, -, *, /
 * with standard math operator precedence.
 *
 * Grammar (no parentheses):
 *   expression = term (('+' | '-') term)*
 *   term       = number (('*' | '/') number)*
 *   number     = ['-'] digits ['.' digits]
 */

interface Parser {
  input: string
  pos: number
}

function skipSpaces(p: Parser): void {
  while (p.pos < p.input.length && p.input[p.pos] === ' ') {
    p.pos++
  }
}

function parseNumber(p: Parser): number | null {
  skipSpaces(p)
  const start = p.pos

  // optional leading minus (only if at start or after operator)
  if (p.pos < p.input.length && p.input[p.pos] === '-') {
    p.pos++
  }

  // must have at least one digit
  if (p.pos >= p.input.length || p.input[p.pos] < '0' || p.input[p.pos] > '9') {
    p.pos = start
    return null
  }

  while (
    p.pos < p.input.length &&
    p.input[p.pos] >= '0' &&
    p.input[p.pos] <= '9'
  ) {
    p.pos++
  }

  // optional decimal part
  if (p.pos < p.input.length && p.input[p.pos] === '.') {
    p.pos++
    if (
      p.pos >= p.input.length ||
      p.input[p.pos] < '0' ||
      p.input[p.pos] > '9'
    ) {
      p.pos = start
      return null
    }
    while (
      p.pos < p.input.length &&
      p.input[p.pos] >= '0' &&
      p.input[p.pos] <= '9'
    ) {
      p.pos++
    }
  }

  return Number(p.input.slice(start, p.pos))
}

function parseTerm(p: Parser): number | null {
  let left = parseNumber(p)
  if (left === null) return null

  while (true) {
    skipSpaces(p)
    if (p.pos >= p.input.length) break
    const op = p.input[p.pos]
    if (op !== '*' && op !== '/') break

    p.pos++
    const right = parseNumber(p)
    if (right === null) return null

    if (op === '*') {
      left = left * right
    } else {
      if (right === 0) return null
      left = left / right
    }
  }

  return left
}

function parseExpression(p: Parser): number | null {
  let left = parseTerm(p)
  if (left === null) return null

  while (true) {
    skipSpaces(p)
    if (p.pos >= p.input.length) break
    const op = p.input[p.pos]
    if (op !== '+' && op !== '-') break

    p.pos++
    const right = parseTerm(p)
    if (right === null) return null

    if (op === '+') {
      left = left + right
    } else {
      left = left - right
    }
  }

  return left
}

/**
 * Evaluates a simple arithmetic expression string.
 *
 * Returns the result as a decimal string (max 2 decimal places),
 * or null if the input is not a valid expression or contains only a plain number.
 *
 * @param input - The expression to evaluate (e.g. "3000-279", "100+50*2")
 * @param decimals - Maximum decimal places in the result (default 2)
 * @returns The evaluated result string, or null if input is plain number or invalid
 */
export function evaluateExpression(
  input: string,
  decimals: number = 2,
): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Fast exit for plain numbers (the common case)
  if (!hasOperator(trimmed)) return null

  const p: Parser = { input: trimmed, pos: 0 }
  const result = parseExpression(p)

  skipSpaces(p)

  // Must consume entire input
  if (result === null || p.pos !== p.input.length) return null

  if (!isFinite(result)) return null

  // Format: remove trailing zeros but keep up to `decimals` places
  return parseFloat(result.toFixed(decimals)).toString()
}

/**
 * Checks whether the input string contains arithmetic operators
 * (ignoring a leading minus which is just a negative sign).
 */
function hasOperator(input: string): boolean {
  // Skip leading minus (negative number, not subtraction)
  const start = input[0] === '-' ? 1 : 0
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      return true
    }
  }
  return false
}
