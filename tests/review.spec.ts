import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '../src/diff.js'
import { ReviewSession, renderFeedback } from '../src/review.js'

const document = parseUnifiedDiff([
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,2 @@',
  '-const value = 1',
  '+const value = 2',
  ' export { value }',
  'diff --git a/src/b.ts b/src/b.ts',
  '--- a/src/b.ts',
  '+++ b/src/b.ts',
  '@@ -5 +5 @@',
  '-oldCall()',
  '+newCall()',
].join('\n'))

describe('review session', () => {
  it('navigates and owns one editable annotation per diff line', () => {
    const session = new ReviewSession(document, 200)
    session.dispatch({ type: 'move', delta: 1 })
    session.dispatch({ type: 'annotate', kind: 'suggestion', text: 'Use the named constant.' })
    session.dispatch({ type: 'annotate', kind: 'issue', text: 'This replaces the annotation.' })
    expect(session.currentAnnotation()?.text).toBe('This replaces the annotation.')

    session.dispatch({ type: 'jump', target: 'file', direction: 1 })
    session.dispatch({ type: 'annotate', kind: 'question', text: 'Is this API available?' })

    expect(session.result()).toMatchObject([
      { file: 'src/a.ts', side: 'new', line: 1, kind: 'issue' },
      { file: 'src/b.ts', side: 'old', line: 5, kind: 'question' },
    ])
    expect(session.render(12, 100)).toContain('dsh-revdiff')
  })

  it('renders DSH-oriented model feedback and supports deletion', () => {
    const session = new ReviewSession(document, 200)
    session.dispatch({ type: 'annotate', kind: 'issue', text: 'Keep the old behavior.' })
    expect(renderFeedback(session.result())).toContain('src/a.ts:1 (old line, issue)')
    session.dispatch({ type: 'delete' })
    expect(session.result()).toEqual([])
  })

  it('enforces the configured comment limit', () => {
    const session = new ReviewSession(document, 5)
    expect(() => session.dispatch({ type: 'annotate', kind: 'issue', text: 'too long' }))
      .toThrow('at most 5 characters')
  })
})
