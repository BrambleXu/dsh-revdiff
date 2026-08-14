/** First-party interactive diff review for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-subprocess'
import Schema from '@deepseek-ai/schemastery'
import { buildGitDiffArgs, parseReviewArguments, REVIEW_HELP, type ReviewRequest } from './command.js'
import { parseUnifiedDiff } from './diff.js'
import { renderFeedback } from './review.js'
import { runTerminalReview } from './terminal.js'

export const name = 'dsh-revdiff'
export const inject = ['commands', 'subprocess']

/** Deployment settings for Git capture and terminal review. */
export interface Config {
  gitBinary: string
  contextLines: number
  maxDiffBytes: number
  diffTimeoutMs: number
  graceMs: number
  maxCommentLength: number
}

export const Config: Schema<Config> = Schema.object({
  gitBinary: Schema.string().default('git'),
  contextLines: Schema.number().step(1).min(0).max(50).default(3),
  maxDiffBytes: Schema.number().step(1).min(1_024).max(128 * 1024 * 1024).default(2 * 1024 * 1024),
  diffTimeoutMs: Schema.number().min(1).max(2_147_483_647).default(30_000),
  graceMs: Schema.number().min(1).max(2_147_483_647).default(2_000),
  maxCommentLength: Schema.number().step(1).min(1).max(100_000).default(4_000),
})

/** Register the DSH-native `/revdiff` review workflow. */
export function apply(ctx: Context, config: Config): void {
  if (config.gitBinary.trim().length === 0) throw new Error('dsh-revdiff gitBinary must not be empty')
  let active = false

  ctx.commands.register({
    name: 'revdiff',
    description: 'Review the current Git diff interactively and send annotations to the agent.',
    input: { hint: '[--staged|--unstaged|base] [-- paths...]' },
    async handler({ agent, rawInput, signal }) {
      if (active) return { kind: 'error', text: 'A diff review is already active in this Harness process.' }
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return { kind: 'error', text: 'Interactive diff review requires the Harness process to own a terminal.' }
      }

      try {
        const command = parseReviewArguments(rawInput)
        if (command.kind === 'help') return { kind: 'success', text: REVIEW_HELP }
        active = true
        const cwd = agent.session.header.cwd ?? process.cwd()
        const patch = await collectDiff(ctx, cwd, command, config, signal)
        const document = parseUnifiedDiff(patch)
        if (document.lineCount === 0) {
          return { kind: 'success', text: patch.trim().length === 0
            ? 'No matching tracked changes to review.'
            : 'The diff contains no reviewable text lines.' }
        }

        const result = await runTerminalReview(document, { maxCommentLength: config.maxCommentLength }, signal)
        if (result.status === 'cancelled') return { kind: 'success', text: 'Diff review cancelled.' }
        if (result.annotations.length === 0) {
          return { kind: 'success', text: 'Diff review completed with no annotations.' }
        }

        agent.followup(createUserMessage({
          content: [{ type: 'text', text: renderFeedback(result.annotations) }],
          source: {
            kind: 'plugin',
            plugin: name,
            form: 'notice',
            summary: `Captured ${result.annotations.length} native diff review annotation${result.annotations.length === 1 ? '' : 's'}.`,
          },
        }))
        return {
          kind: 'success',
          text: `Sent ${result.annotations.length} diff review annotation${result.annotations.length === 1 ? '' : 's'} to the agent.`,
        }
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      } finally {
        active = false
      }
    },
  })
}

async function collectDiff(
  ctx: Context,
  cwd: string,
  request: ReviewRequest,
  config: Config,
  signal: AbortSignal,
): Promise<string> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(new Error('Git diff timed out')), config.diffTimeoutMs)
  const combined = AbortSignal.any([signal, timeout.signal])
  try {
    const child = ctx.subprocess.spawn({
      argv: [config.gitBinary, ...buildGitDiffArgs(request, config.contextLines)],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: config.maxDiffBytes },
        stderr: { maxBytes: Math.min(config.maxDiffBytes, 64 * 1024) },
      },
      graceMs: config.graceMs,
      signal: combined,
    })
    const outcome = await child.done
    await child.waitForExit()
    if (timeout.signal.aborted) throw timeout.signal.reason
    signal.throwIfAborted()
    const stdout = child.collected.stdout?.readFrom(0)
    const stderr = child.collected.stderr?.readFrom(0)
    if (stdout?.lossy === true) throw new Error(`Git diff exceeds maxDiffBytes (${config.maxDiffBytes})`)
    if (outcome.exitCode !== 0) {
      const detail = stderr?.text.trim()
      throw new Error(detail === undefined || detail === ''
        ? `Git diff exited with code ${String(outcome.exitCode)}`
        : detail)
    }
    return stdout?.text ?? ''
  } finally {
    clearTimeout(timer)
  }
}
