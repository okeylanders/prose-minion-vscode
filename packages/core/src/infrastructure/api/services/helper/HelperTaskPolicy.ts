/**
 * HelperTaskPolicy — what one helper task brings to the shared engine (ADR
 * 2026-11-05 D1): its prompt section, its input builder, its output codec,
 * its bounds and its call settings. The engine reads only this shape, so a
 * new task is a new policy, never a branch in the engine.
 *
 * Plain data in, plain data out (D2, D4): a policy imports no Workshop,
 * Lightbox or Draft Edit module, and its decoder never repairs an answer
 * into something the model did not say. A fault drops the answer, named by
 * its kind for the log, never with the text.
 */

/** The generic prompt every task's section follows (D1). */
export const HELPER_BASE_PROMPT = 'helper/00-helper.md';

/** Why an answer was dropped: closed, so logs and tests name a kind, never text. */
export type HelperReplyFault =
  /** The reply reached its output ceiling. */
  | 'cut-off'
  /** The reply was longer than the task's `responseCharacters`. */
  | 'too-long'
  /** The reply was not JSON, even under the shared parser's structure-only repairs. */
  | 'malformed-json'
  /** The JSON's root was not an object. */
  | 'not-an-object'
  /** A field the task requires was absent. */
  | 'missing-field'
  /** A field the task does not define was present. */
  | 'unknown-field'
  /** A field held the wrong type. */
  | 'wrong-type'
  /** A text field was empty. */
  | 'empty-field'
  /** A one-line field held a control character, a line break or a line/paragraph separator. */
  | 'multi-line'
  /** A field was longer than its bound. */
  | 'over-bound'
  /** A field held a value outside its closed vocabulary. */
  | 'outside-vocabulary';

export type HelperDecoded<Output> =
  | { readonly ok: true; readonly value: Output }
  | { readonly ok: false; readonly fault: HelperReplyFault };

/**
 * The settings every call of a task is made with. No reasoning level of its
 * own: the engine asks every task's calls for reasoning `off` (D1, amended
 * 2026-11-06), so a task's ceiling is the reply's alone.
 */
export interface HelperCallSettings {
  readonly temperature: 0;
  /** The reply's ceiling, in tokens. */
  readonly outputTokens: number;
  /** A reply longer than this, in characters, is refused before it is read. */
  readonly responseCharacters: number;
  /** A call still unanswered after this many milliseconds is stopped and counted as a timeout. */
  readonly timeoutMs: number;
}

export interface HelperTaskPolicy<Input, Output> {
  /** The prompt section after the generic `00-helper.md`, under `system-prompts/`. */
  readonly promptSection: string;
  /**
   * The task's data for the user message: plain JSON, quoted, never
   * instructions. The engine wraps it with the task's name.
   */
  readonly buildInput: (input: Input) => Readonly<Record<string, unknown>>;
  /** Counts of the input for the log line, never its text. */
  readonly describeInput: (input: Input) => Readonly<Record<string, number>>;
  /** The parsed root, read with exact fields. */
  readonly decode: (root: Readonly<Record<string, unknown>>) => HelperDecoded<Output>;
  readonly call: HelperCallSettings;
}

/** Any task's policy, for the registry's constraint. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a registry holds policies of differing inputs and outputs; each is typed where it is read.
export type AnyHelperTaskPolicy = HelperTaskPolicy<any, any>;

export type HelperTaskInput<P> = P extends HelperTaskPolicy<infer Input, unknown> ? Input : never;
export type HelperTaskOutput<P> = P extends HelperTaskPolicy<never, infer Output> ? Output : never;

/**
 * The root's fields, exactly: every required field present, nothing else.
 * Returns the first fault, or undefined when the shape holds.
 */
export function helperExactFields(
  root: Readonly<Record<string, unknown>>,
  required: readonly string[]
): HelperReplyFault | undefined {
  const keys = Object.keys(root);
  if (required.some((field) => !Object.prototype.hasOwnProperty.call(root, field))) {
    return 'missing-field';
  }
  if (keys.some((key) => !required.includes(key))) {
    return 'unknown-field';
  }
  return undefined;
}

/**
 * One line of text within `maxCharacters` (UTF-16 code units, as a text
 * field's `maxLength` counts), trimmed of surrounding space; `notOneLine`
 * is the data's own rule for what breaks a line, so the helper keeps no
 * second copy of it. A fault, never a clip: a clipped answer would be one
 * the model did not give.
 */
export function helperLine(value: unknown, maxCharacters: number, notOneLine: RegExp): HelperDecoded<string> {
  if (typeof value !== 'string') {
    return { ok: false, fault: 'wrong-type' };
  }
  const text = value.trim();
  if (text === '') {
    return { ok: false, fault: 'empty-field' };
  }
  if (notOneLine.test(text)) {
    return { ok: false, fault: 'multi-line' };
  }
  if (text.length > maxCharacters) {
    return { ok: false, fault: 'over-bound' };
  }
  return { ok: true, value: text };
}
