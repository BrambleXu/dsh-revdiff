/** Parsing for the intentionally small `/revdiff` command interface. */
/** Diff source selected by a review command. */
export type ReviewMode = 'working' | 'staged' | 'unstaged';
/** One resolved request for Git-backed review data. */
export interface ReviewRequest {
    kind: 'review';
    mode: ReviewMode;
    base?: string;
    paths: string[];
}
/** Parsed command input, including the help-only branch. */
export type ReviewCommand = ReviewRequest | {
    kind: 'help';
};
/** Split a command suffix without invoking a shell. */
export declare function splitArguments(input: string): string[];
/** Resolve user input into the supported review modes and path scope. */
export declare function parseReviewArguments(input: string): ReviewCommand;
/** Build a non-shell Git argv suffix for one resolved request. */
export declare function buildGitDiffArgs(command: ReviewCommand, contextLines: number): string[];
/** Human-facing command help. */
export declare const REVIEW_HELP: string;
