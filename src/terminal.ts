/** Interactive terminal adapter for the in-process review session. */

import type { DiffDocument } from './diff.js'
import { ReviewSession, type AnnotationKind, type ReviewAnnotation } from './review.js'

/** Settings owned by the terminal review adapter. */
export interface TerminalReviewOptions {
  maxCommentLength: number
}

/** Terminal review settlement. */
export type TerminalReviewResult =
  | { status: 'submitted'; annotations: ReviewAnnotation[] }
  | { status: 'cancelled' }

const CLEAR = '\u001b[2J\u001b[H'
const HIDE_CURSOR = '\u001b[?25l'
const SHOW_CURSOR = '\u001b[?25h'

/** Run an owned full-screen review against the Harness process terminal. */
export async function runTerminalReview(
  document: DiffDocument,
  options: TerminalReviewOptions,
  signal: AbortSignal,
): Promise<TerminalReviewResult> {
  const input = process.stdin
  const output = process.stdout
  const wasRaw = input.isRaw
  const wasFlowing = input.readableFlowing
  const keys = new KeyReader(input)
  const session = new ReviewSession(document, options.maxCommentLength)
  let settlement: TerminalReviewResult | undefined

  input.setRawMode(true)
  input.resume()
  output.write(HIDE_CURSOR)
  try {
    while (settlement === undefined) {
      signal.throwIfAborted()
      output.write(`${CLEAR}${session.render(output.rows ?? 24, output.columns ?? 80)}`)
      const key = await keys.next(signal)
      if (key === 'up' || key === 'k') session.dispatch({ type: 'move', delta: -1 })
      else if (key === 'down' || key === 'j') session.dispatch({ type: 'move', delta: 1 })
      else if (key === 'n') session.dispatch({ type: 'jump', target: 'hunk', direction: 1 })
      else if (key === 'p') session.dispatch({ type: 'jump', target: 'hunk', direction: -1 })
      else if (key === ']' || key === 'right') session.dispatch({ type: 'jump', target: 'file', direction: 1 })
      else if (key === '[' || key === 'left') session.dispatch({ type: 'jump', target: 'file', direction: -1 })
      else if (key === 'd') session.dispatch({ type: 'delete' })
      else if (key === 'a' || key === 'e') {
        try {
          await editAnnotation(session, keys, output, signal)
        } catch (error) {
          signal.throwIfAborted()
          output.write(`${CLEAR}${error instanceof Error ? error.message : String(error)}\n\nPress any key to continue.`)
          await keys.next(signal)
        }
      } else if (key === 's') {
        settlement = { status: 'submitted', annotations: session.result() }
      } else if (key === 'q' || key === 'escape' || key === 'ctrl-c') {
        settlement = { status: 'cancelled' }
      }
    }
    return settlement
  } finally {
    input.setRawMode(wasRaw)
    if (wasFlowing !== true) input.pause()
    const summary = settlement?.status === 'submitted'
      ? `dsh-revdiff: submitted ${settlement.annotations.length} annotation${settlement.annotations.length === 1 ? '' : 's'}.`
      : 'dsh-revdiff: review cancelled.'
    output.write(`${SHOW_CURSOR}${CLEAR}${summary}\n`)
  }
}

async function editAnnotation(
  session: ReviewSession,
  keys: KeyReader,
  output: NodeJS.WriteStream,
  signal: AbortSignal,
): Promise<void> {
  const current = session.currentAnnotation()
  output.write(SHOW_CURSOR)
  try {
    const defaultKind = current?.kind ?? 'issue'
    const kindInputRaw = await readLine(
      keys,
      output,
      `Kind [i]ssue/[s]uggestion/[q]uestion/[p]raise (Enter=${defaultKind}, x=cancel): `,
      signal,
    )
    if (kindInputRaw === undefined) return
    const kindInput = kindInputRaw.trim().toLowerCase()
    if (kindInput === 'x') return
    const kind = resolveKind(kindInput, defaultKind)
    const textInput = await readLine(
      keys,
      output,
      current === undefined ? 'Comment: ' : `Comment (Enter keeps ${JSON.stringify(current.text)}): `,
      signal,
    )
    if (textInput === undefined) return
    const text = textInput.trim().length === 0 ? current?.text : textInput
    if (text === undefined || text.trim().length === 0) return
    session.dispatch({ type: 'annotate', kind, text })
  } finally {
    output.write(HIDE_CURSOR)
  }
}

async function readLine(
  keys: KeyReader,
  output: NodeJS.WriteStream,
  label: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const characters: string[] = []
  const draw = (): void => { output.write(`${CLEAR}${label}${characters.join('')}`) }
  draw()
  while (true) {
    const key = await keys.next(signal)
    if (key === 'ctrl-c' || key === 'escape') return undefined
    if (key === 'enter') return characters.join('')
    if (key === 'backspace') characters.pop()
    else if ([...key].length === 1 && key >= ' ') characters.push(key)
    else continue
    draw()
  }
}

function resolveKind(value: string, fallback: AnnotationKind): AnnotationKind {
  if (value === '') return fallback
  if (value === 'i' || value === 'issue') return 'issue'
  if (value === 's' || value === 'suggestion') return 'suggestion'
  if (value === 'q' || value === 'question') return 'question'
  if (value === 'p' || value === 'praise') return 'praise'
  throw new Error(`unknown annotation kind ${JSON.stringify(value)}`)
}

class KeyReader {
  private readonly queued: string[] = []

  constructor(private readonly input: NodeJS.ReadStream) {}

  async next(signal: AbortSignal): Promise<string> {
    signal.throwIfAborted()
    const queued = this.queued.shift()
    if (queued !== undefined) return queued
    return new Promise<string>((resolve, reject) => {
      const cleanup = (): void => {
        this.input.off('data', onData)
        signal.removeEventListener('abort', onAbort)
      }
      const onAbort = (): void => {
        cleanup()
        reject(signal.reason)
      }
      const onData = (chunk: Buffer | string): void => {
        cleanup()
        const keys = decodeKeys(chunk.toString())
        const first = keys.shift()
        this.queued.push(...keys)
        if (first === undefined) reject(new Error('terminal produced an empty input event'))
        else resolve(first)
      }
      this.input.once('data', onData)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }
}

function decodeKeys(value: string): string[] {
  const result: string[] = []
  for (let index = 0; index < value.length;) {
    const sequence = value.slice(index, index + 3)
    if (sequence === '\u001b[A') result.push('up')
    else if (sequence === '\u001b[B') result.push('down')
    else if (sequence === '\u001b[C') result.push('right')
    else if (sequence === '\u001b[D') result.push('left')
    else {
      const codePoint = value.codePointAt(index)
      if (codePoint === undefined) break
      const character = String.fromCodePoint(codePoint)
      result.push(character === '\u0003'
        ? 'ctrl-c'
        : character === '\u001b'
          ? 'escape'
          : character === '\r' || character === '\n'
            ? 'enter'
            : character === '\u007f' || character === '\b'
              ? 'backspace'
              : character)
      index += character.length
      continue
    }
    index += 3
  }
  return result
}
