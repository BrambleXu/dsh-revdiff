/** In-memory review session, terminal rendering, and Agent feedback. */
const RESET = '\u001b[0m';
const DIM = '\u001b[2m';
const INVERSE = '\u001b[7m';
const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const CYAN = '\u001b[36m';
const YELLOW = '\u001b[33m';
/** Own navigation and annotations for one parsed diff behind a small action interface. */
export class ReviewSession {
    maxCommentLength;
    rows;
    annotations = new Map();
    cursor = 0;
    constructor(document, maxCommentLength) {
        this.maxCommentLength = maxCommentLength;
        this.rows = document.files.flatMap((file, fileIndex) => file.hunks.flatMap((hunk, hunkIndex) => hunk.lines.map(line => ({ file, hunk, line, fileIndex, hunkIndex }))));
        if (this.rows.length === 0)
            throw new Error('diff contains no reviewable text lines');
    }
    /** Apply one navigation or annotation action. */
    dispatch(action) {
        if (action.type === 'move') {
            this.cursor = clamp(this.cursor + action.delta, 0, this.rows.length - 1);
            return;
        }
        if (action.type === 'jump') {
            this.jump(action.target, action.direction);
            return;
        }
        const current = this.current();
        if (action.type === 'delete') {
            this.annotations.delete(current.line.id);
            return;
        }
        const text = action.text.trim();
        if (text.length === 0)
            throw new Error('annotation text must not be empty');
        if (text.length > this.maxCommentLength) {
            throw new Error(`annotation text must be at most ${this.maxCommentLength} characters`);
        }
        const side = current.line.kind === 'delete' ? 'old' : 'new';
        const line = side === 'old' ? current.line.oldLine : current.line.newLine;
        if (line === undefined)
            throw new Error('selected diff line has no source location');
        this.annotations.set(current.line.id, {
            order: this.cursor,
            annotation: {
                file: current.file.path,
                side,
                line,
                kind: action.kind,
                text,
                code: current.line.content,
            },
        });
    }
    /** Return the annotation on the selected line, if one exists. */
    currentAnnotation() {
        return this.annotations.get(this.current().line.id)?.annotation;
    }
    /** Return annotations in document order. */
    result() {
        return [...this.annotations.values()]
            .sort((left, right) => left.order - right.order)
            .map(item => ({ ...item.annotation }));
    }
    /** Render the current terminal viewport. */
    render(rows, columns) {
        const current = this.current();
        const viewportRows = Math.max(3, rows - 7);
        const start = clamp(this.cursor - Math.floor(viewportRows / 2), 0, Math.max(0, this.rows.length - viewportRows));
        const visible = this.rows.slice(start, start + viewportRows);
        const reviewableFiles = [...new Set(this.rows.map(row => row.fileIndex))];
        const filePosition = reviewableFiles.indexOf(current.fileIndex) + 1;
        const hunkCount = current.file.hunks.length;
        const header = [
            `${CYAN}dsh-revdiff${RESET}  ${current.file.path}  ${DIM}file ${filePosition}/${reviewableFiles.length} · hunk ${current.hunkIndex + 1}/${hunkCount} · ${this.annotations.size} annotation${this.annotations.size === 1 ? '' : 's'}${RESET}`,
            `${DIM}${current.hunk.header || '@@'}${RESET}`,
            '',
        ];
        const body = visible.map(row => this.renderRow(row, columns));
        const selected = this.currentAnnotation();
        const note = selected === undefined
            ? `${DIM}No annotation on selected line.${RESET}`
            : `${YELLOW}${selected.kind}:${RESET} ${truncate(selected.text, Math.max(10, columns - selected.kind.length - 3))}`;
        const footer = [
            '',
            note,
            `${DIM}↑/k ↓/j line · n/p hunk · ]/[ file · a annotate · e edit · d delete · s submit · q cancel${RESET}`,
        ];
        return [...header, ...body, ...footer].join('\n');
    }
    current() {
        const row = this.rows[this.cursor];
        if (row === undefined)
            throw new Error('review cursor is outside the document');
        return row;
    }
    jump(target, direction) {
        const current = this.current();
        const identity = target === 'file'
            ? (row) => String(row.fileIndex)
            : (row) => `${row.fileIndex}:${row.hunkIndex}`;
        const currentIdentity = identity(current);
        if (direction === 1) {
            const next = this.rows.findIndex((row, index) => index > this.cursor && identity(row) !== currentIdentity);
            if (next !== -1)
                this.cursor = next;
            return;
        }
        let previous = -1;
        for (let index = this.cursor - 1; index >= 0; index -= 1) {
            const row = this.rows[index];
            if (row !== undefined && identity(row) !== currentIdentity) {
                previous = index;
                break;
            }
        }
        if (previous === -1)
            return;
        const previousIdentity = identity(this.rows[previous]);
        while (previous > 0 && identity(this.rows[previous - 1]) === previousIdentity)
            previous -= 1;
        this.cursor = previous;
    }
    renderRow(row, columns) {
        const selected = row.line.id === this.current().line.id;
        const annotated = this.annotations.has(row.line.id) ? '●' : ' ';
        const marker = row.line.kind === 'add' ? '+' : row.line.kind === 'delete' ? '-' : ' ';
        const lineNumber = row.line.kind === 'delete' ? row.line.oldLine : row.line.newLine;
        const content = `${annotated} ${marker} ${String(lineNumber ?? '').padStart(5)} │ ${row.line.content}`;
        const clipped = truncate(content, Math.max(20, columns));
        const color = row.line.kind === 'add' ? GREEN : row.line.kind === 'delete' ? RED : '';
        return selected ? `${INVERSE}${color}${clipped}${RESET}` : `${color}${clipped}${RESET}`;
    }
}
/** Render structured review comments as an actionable, DSH-native Agent turn. */
export function renderFeedback(annotations) {
    const lines = [
        'Apply the following feedback from the user\'s interactive review of the current workspace diff.',
        'Treat old-line locations as comments on removed code and new-line locations as comments on the resulting file.',
        '',
    ];
    annotations.forEach((annotation, index) => {
        lines.push(`${index + 1}. ${annotation.file}:${annotation.line} (${annotation.side} line, ${annotation.kind})`);
        lines.push(`   Code: ${annotation.code}`);
        lines.push(`   Feedback: ${annotation.text}`);
        lines.push('');
    });
    return lines.join('\n').trim();
}
function truncate(value, width) {
    const characters = [...value];
    return characters.length <= width ? value : `${characters.slice(0, Math.max(1, width - 1)).join('')}…`;
}
function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
//# sourceMappingURL=review.js.map