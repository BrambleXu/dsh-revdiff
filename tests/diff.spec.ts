import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '../src/diff.js'

const PATCH = [
  'diff --git a/src/example.ts b/src/example.ts',
  'index 1111111..2222222 100644',
  '--- a/src/example.ts',
  '+++ b/src/example.ts',
  '@@ -10,3 +10,4 @@ export function value() {',
  ' const before = 1',
  '-return before',
  '+const after = before + 1',
  '+return after',
  ' }',
  '\\ No newline at end of file',
].join('\n')

describe('unified diff parser', () => {
  it('tracks files, hunks, sides, and line numbers', () => {
    const document = parseUnifiedDiff(PATCH)
    expect(document.files).toHaveLength(1)
    expect(document.files[0]?.path).toBe('src/example.ts')
    expect(document.files[0]?.hunks[0]?.lines).toMatchObject([
      { kind: 'context', oldLine: 10, newLine: 10, content: 'const before = 1' },
      { kind: 'delete', oldLine: 11, content: 'return before' },
      { kind: 'add', newLine: 11, content: 'const after = before + 1' },
      { kind: 'add', newLine: 12, content: 'return after' },
      { kind: 'context', oldLine: 12, newLine: 13, content: '}' },
    ])
    expect(document.lineCount).toBe(5)
  })

  it('uses the old path for deleted files', () => {
    const document = parseUnifiedDiff([
      'diff --git a/old name.txt b/old name.txt',
      'deleted file mode 100644',
      '--- a/old name.txt',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-gone',
    ].join('\n'))
    expect(document.files[0]?.path).toBe('old name.txt')
    expect(document.files[0]?.hunks[0]?.lines[0]).toMatchObject({ kind: 'delete', oldLine: 1 })
  })
})
