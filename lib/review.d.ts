/** In-memory review session, terminal rendering, and Agent feedback. */
import type { DiffDocument } from './diff.js';
/** Meaning attached to one review comment. */
export type AnnotationKind = 'issue' | 'suggestion' | 'question' | 'praise';
/** One structured comment delivered to the Harness Agent. */
export interface ReviewAnnotation {
    file: string;
    side: 'old' | 'new';
    line: number;
    kind: AnnotationKind;
    text: string;
    code: string;
}
/** State transition supported by a review session. */
export type ReviewAction = {
    type: 'move';
    delta: number;
} | {
    type: 'jump';
    target: 'file' | 'hunk';
    direction: -1 | 1;
} | {
    type: 'annotate';
    kind: AnnotationKind;
    text: string;
} | {
    type: 'delete';
};
/** Own navigation and annotations for one parsed diff behind a small action interface. */
export declare class ReviewSession {
    private readonly maxCommentLength;
    private readonly rows;
    private readonly annotations;
    private cursor;
    constructor(document: DiffDocument, maxCommentLength: number);
    /** Apply one navigation or annotation action. */
    dispatch(action: ReviewAction): void;
    /** Return the annotation on the selected line, if one exists. */
    currentAnnotation(): ReviewAnnotation | undefined;
    /** Return annotations in document order. */
    result(): ReviewAnnotation[];
    /** Render the current terminal viewport. */
    render(rows: number, columns: number): string;
    private current;
    private jump;
    private renderRow;
}
/** Render structured review comments as an actionable, DSH-native Agent turn. */
export declare function renderFeedback(annotations: readonly ReviewAnnotation[]): string;
