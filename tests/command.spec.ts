import { describe, expect, it } from 'vitest'
import { buildGitDiffArgs, parseReviewArguments } from '../src/command.js'

describe('review command', () => {
  it('resolves the default working-tree review against HEAD', () => {
    const request = parseReviewArguments('')
    expect(request).toEqual({ kind: 'review', mode: 'working', paths: [] })
    expect(buildGitDiffArgs(request, 4)).toEqual([
      '-c', 'color.ui=false', '-c', 'core.quotePath=false',
      'diff', '--no-ext-diff', '--no-color', '--unified=4', 'HEAD', '--',
    ])
  })

  it('supports staged, unstaged, base, and path-scoped reviews', () => {
    expect(buildGitDiffArgs(parseReviewArguments('--staged -- src/a.ts'), 3))
      .toContain('--cached')
    expect(buildGitDiffArgs(parseReviewArguments('--unstaged -- src/a.ts'), 3))
      .not.toContain('HEAD')
    expect(buildGitDiffArgs(parseReviewArguments('main -- "src/a file.ts"'), 3))
      .toEqual(expect.arrayContaining(['main', '--', 'src/a file.ts']))
  })

  it('rejects ambiguous or unsupported arguments', () => {
    expect(() => parseReviewArguments('--unstaged --base main')).toThrow('cannot be combined')
    expect(() => parseReviewArguments('main other')).toThrow('only one base')
    expect(() => parseReviewArguments('--output notes.md')).toThrow('unknown option')
  })
})
