/**
 * Shared fixtures for the Lightbox reading tests: the prompt bundle on disk,
 * and its worked examples parsed into their request paragraphs and response.
 * The examples read the opening of Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain). No writer's text is committed.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { LightboxLensId, LightboxReadingGroupId } from '@messages';
import { LIGHTBOX_PROMPT_FILES } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { lightboxGroupLenses } from '@shared/constants/lightbox';

export const PROMPT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'resources', 'system-prompts');

export function readLightboxPrompt(file: string): string {
  return fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8');
}

export interface WorkedExample {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
  /** The request block, exactly as the example shows it. */
  request: string;
  /** Paragraph texts parsed from the request's markers; index 0 is ¶1. */
  paragraphs: string[];
  /** The framed response, sentinels included. */
  response: string;
}

export function readWorkedExample(group: LightboxReadingGroupId): WorkedExample {
  const text = readLightboxPrompt(LIGHTBOX_PROMPT_FILES.examples[group]);
  const requestStart = text.indexOf('--- example request ---\n\n') + '--- example request ---\n\n'.length;
  const requestEnd = text.indexOf('\n\n--- end of example request ---');
  const request = text.slice(requestStart, requestEnd);
  const chapter = request.slice(0, request.indexOf('\n\n# Task'));
  const paragraphs = chapter
    .split(/\n\n(?=⟦¶\d+⟧ )/)
    .filter((block) => block.startsWith('⟦¶'))
    .map((block) => block.replace(/^⟦¶\d+⟧ /, ''));
  const start = `===LIGHTBOX_GROUP_${group}_V1===`;
  const end = `===END_LIGHTBOX_GROUP_${group}_V1===`;
  // The task line names the sentinels too; the response's stand on lines of their own.
  const response = text.slice(text.indexOf(`\n${start}\n`) + 1, text.indexOf(`\n${end}\n`) + end.length + 1);
  return { group, lenses: lightboxGroupLenses(group), request, paragraphs, response };
}

/** The JSON between a framed response's sentinels. */
export function framedJson(response: string): Record<string, unknown> {
  const lines = response.split('\n');
  return JSON.parse(lines.slice(1, -1).join('\n')) as Record<string, unknown>;
}

/** Re-frame a JSON body for group `group`. */
export function frame(group: LightboxReadingGroupId, body: unknown): string {
  return [`===LIGHTBOX_GROUP_${group}_V1===`, JSON.stringify(body), `===END_LIGHTBOX_GROUP_${group}_V1===`].join('\n');
}
