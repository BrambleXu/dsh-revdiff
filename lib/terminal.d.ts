/** Interactive terminal adapter for the in-process review session. */
import type { DiffDocument } from './diff.js';
import { type ReviewAnnotation } from './review.js';
/** Settings owned by the terminal review adapter. */
export interface TerminalReviewOptions {
    maxCommentLength: number;
}
/** Terminal review settlement. */
export type TerminalReviewResult = {
    status: 'submitted';
    annotations: ReviewAnnotation[];
} | {
    status: 'cancelled';
};
/** Run an owned full-screen review against the Harness process terminal. */
export declare function runTerminalReview(document: DiffDocument, options: TerminalReviewOptions, signal: AbortSignal): Promise<TerminalReviewResult>;
