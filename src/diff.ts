/** Git unified-diff parsing and review document vocabulary. */

/** One reviewable line in a unified diff hunk. */
export interface DiffLine {
  id: string
  kind: 'context' | 'add' | 'delete'
  content: string
  oldLine?: number
  newLine?: number
}

/** One parsed unified-diff hunk. */
export interface DiffHunk {
  header: string
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

/** One file represented in the diff. */
export interface DiffFile {
  path: string
  oldPath: string
  newPath: string
  hunks: DiffHunk[]
}

/** Complete review input. */
export interface DiffDocument {
  files: DiffFile[]
  lineCount: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(?: ?(.*))?$/u

/** Parse textual Git unified-diff output into navigable files and hunks. */
export function parseUnifiedDiff(patch: string): DiffDocument {
  const files: DiffFile[] = []
  let oldPath: string | undefined
  let currentFile: DiffFile | undefined
  let currentHunk: DiffHunk | undefined
  let oldLine = 0
  let newLine = 0
  let lineCount = 0

  for (const rawLine of patch.split(/\r?\n/u)) {
    if (rawLine.startsWith('diff --git ')) {
      oldPath = undefined
      currentFile = undefined
      currentHunk = undefined
      continue
    }
    if (rawLine.startsWith('--- ')) {
      oldPath = parsePatchPath(rawLine.slice(4))
      currentHunk = undefined
      continue
    }
    if (rawLine.startsWith('+++ ')) {
      const newPath = parsePatchPath(rawLine.slice(4))
      const resolvedOldPath = oldPath ?? newPath
      const path = newPath === '/dev/null' ? resolvedOldPath : newPath
      currentFile = { path, oldPath: resolvedOldPath, newPath, hunks: [] }
      files.push(currentFile)
      currentHunk = undefined
      continue
    }

    const header = HUNK_HEADER.exec(rawLine)
    if (header !== null && currentFile !== undefined) {
      oldLine = Number.parseInt(header[1] ?? '0', 10)
      newLine = Number.parseInt(header[2] ?? '0', 10)
      currentHunk = {
        header: header[3] ?? '',
        oldStart: oldLine,
        newStart: newLine,
        lines: [],
      }
      currentFile.hunks.push(currentHunk)
      continue
    }
    if (currentFile === undefined || currentHunk === undefined || rawLine.startsWith('\\ No newline at end of file')) continue

    const marker = rawLine[0]
    if (marker !== ' ' && marker !== '+' && marker !== '-') continue
    const id = `${files.length - 1}:${currentFile.hunks.length - 1}:${currentHunk.lines.length}`
    if (marker === ' ') {
      currentHunk.lines.push({ id, kind: 'context', content: rawLine.slice(1), oldLine, newLine })
      oldLine += 1
      newLine += 1
    } else if (marker === '+') {
      currentHunk.lines.push({ id, kind: 'add', content: rawLine.slice(1), newLine })
      newLine += 1
    } else {
      currentHunk.lines.push({ id, kind: 'delete', content: rawLine.slice(1), oldLine })
      oldLine += 1
    }
    lineCount += 1
  }

  return { files, lineCount }
}

function parsePatchPath(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '/dev/null') return trimmed
  const decoded = trimmed.startsWith('"') && trimmed.endsWith('"')
    ? decodeQuotedPath(trimmed.slice(1, -1))
    : trimmed
  return decoded.startsWith('a/') || decoded.startsWith('b/') ? decoded.slice(2) : decoded
}

function decodeQuotedPath(value: string): string {
  return value.replace(/\\([0-7]{3}|[\\"tnr])/gu, (_, escape: string) => {
    if (/^[0-7]{3}$/u.test(escape)) return String.fromCharCode(Number.parseInt(escape, 8))
    if (escape === 't') return '\t'
    if (escape === 'n') return '\n'
    if (escape === 'r') return '\r'
    return escape
  })
}
