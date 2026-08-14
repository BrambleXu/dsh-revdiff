/** Parsing for the intentionally small `/revdiff` command interface. */

/** Diff source selected by a review command. */
export type ReviewMode = 'working' | 'staged' | 'unstaged'

/** One resolved request for Git-backed review data. */
export interface ReviewRequest {
  kind: 'review'
  mode: ReviewMode
  base?: string
  paths: string[]
}

/** Parsed command input, including the help-only branch. */
export type ReviewCommand = ReviewRequest | { kind: 'help' }

/** Split a command suffix without invoking a shell. */
export function splitArguments(input: string): string[] {
  const result: string[] = []
  let token = ''
  let quote: '"' | "'" | undefined
  let escaped = false

  for (const character of input.trim()) {
    if (escaped) {
      token += character
      escaped = false
    } else if (character === '\\' && quote !== "'") {
      escaped = true
    } else if (quote !== undefined) {
      if (character === quote) quote = undefined
      else token += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (/\s/u.test(character)) {
      if (token.length > 0) {
        result.push(token)
        token = ''
      }
    } else {
      token += character
    }
  }

  if (escaped) token += '\\'
  if (quote !== undefined) throw new Error('review arguments contain an unclosed quote')
  if (token.length > 0) result.push(token)
  return result
}

/** Resolve user input into the supported review modes and path scope. */
export function parseReviewArguments(input: string): ReviewCommand {
  const args = splitArguments(input)
  let mode: ReviewMode = 'working'
  let base: string | undefined
  let paths: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === undefined) continue
    if (value === '--') {
      paths = args.slice(index + 1)
      break
    }
    if (value === '-h' || value === '--help') return { kind: 'help' }
    if (value === '--staged' || value === '--unstaged') {
      const selected: ReviewMode = value === '--staged' ? 'staged' : 'unstaged'
      if (mode !== 'working' && mode !== selected) throw new Error('--staged and --unstaged are mutually exclusive')
      mode = selected
      continue
    }
    if (value === '--base') {
      const next = args[index + 1]
      if (next === undefined || next.startsWith('-')) throw new Error('--base requires a Git revision')
      if (base !== undefined) throw new Error('only one base revision may be specified')
      base = next
      index += 1
      continue
    }
    if (value.startsWith('--base=')) {
      const next = value.slice('--base='.length)
      if (next.length === 0) throw new Error('--base requires a Git revision')
      if (base !== undefined) throw new Error('only one base revision may be specified')
      base = next
      continue
    }
    if (value.startsWith('-')) throw new Error(`unknown option ${JSON.stringify(value)}`)
    if (base !== undefined) throw new Error('only one base revision may be specified; put file paths after --')
    base = value
  }

  if (mode === 'unstaged' && base !== undefined) throw new Error('--unstaged cannot be combined with a base revision')
  return {
    kind: 'review',
    mode,
    ...(base === undefined ? {} : { base }),
    paths,
  }
}

/** Build a non-shell Git argv suffix for one resolved request. */
export function buildGitDiffArgs(command: ReviewCommand, contextLines: number): string[] {
  if (command.kind === 'help') throw new Error('help does not produce a Git diff')
  const args = [
    '-c', 'color.ui=false',
    '-c', 'core.quotePath=false',
    'diff', '--no-ext-diff', '--no-color', `--unified=${contextLines}`,
  ]
  if (command.mode === 'working') args.push(command.base ?? 'HEAD')
  else if (command.mode === 'staged') {
    args.push('--cached')
    if (command.base !== undefined) args.push(command.base)
  }
  args.push('--', ...command.paths)
  return args
}

/** Human-facing command help. */
export const REVIEW_HELP = [
  '/revdiff [base] [-- <path>...]',
  '/revdiff --staged [--base <ref>] [-- <path>...]',
  '/revdiff --unstaged [-- <path>...]',
  '',
  'Default: review all tracked working-tree changes against HEAD.',
].join('\n')
