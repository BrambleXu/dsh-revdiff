/** First-party interactive diff review for DeepSeek Harness. */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "dsh-revdiff";
export declare const inject: string[];
/** Deployment settings for Git capture and terminal review. */
export interface Config {
    gitBinary: string;
    contextLines: number;
    maxDiffBytes: number;
    diffTimeoutMs: number;
    graceMs: number;
    maxCommentLength: number;
}
export declare const Config: Schema<Config>;
/** Register the DSH-native `/revdiff` review workflow. */
export declare function apply(ctx: Context, config: Config): void;
