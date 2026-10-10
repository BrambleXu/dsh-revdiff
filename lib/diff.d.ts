/** Git unified-diff parsing and review document vocabulary. */
/** One reviewable line in a unified diff hunk. */
export interface DiffLine {
    id: string;
    kind: 'context' | 'add' | 'delete';
    content: string;
    oldLine?: number;
    newLine?: number;
}
/** One parsed unified-diff hunk. */
export interface DiffHunk {
    header: string;
    oldStart: number;
    newStart: number;
    lines: DiffLine[];
}
/** One file represented in the diff. */
export interface DiffFile {
    path: string;
    oldPath: string;
    newPath: string;
    hunks: DiffHunk[];
}
/** Complete review input. */
export interface DiffDocument {
    files: DiffFile[];
    lineCount: number;
}
/** Parse textual Git unified-diff output into navigable files and hunks. */
export declare function parseUnifiedDiff(patch: string): DiffDocument;
