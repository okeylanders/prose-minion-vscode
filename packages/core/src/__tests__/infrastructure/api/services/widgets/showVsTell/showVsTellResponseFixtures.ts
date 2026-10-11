/**
 * Response fixtures for the Show vs. Tell service tests. The valid response is
 * the prompt bundle's own example, so these tests fail if the example the model
 * is taught stops decoding through the real codec.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { WorkshopShowVsTellInvariants } from '@messages';
import {
  SHOW_VS_TELL_RESPONSE_END,
  SHOW_VS_TELL_RESPONSE_START
} from '@services/widgets/showVsTell/ShowVsTellResponseCodec';

const EXAMPLE_PATH = path.resolve(
  __dirname, '..', '..', '..', '..', '..', '..', '..',
  'resources', 'system-prompts', 'show-vs-tell', '01-show-vs-tell-example.md'
);

export const SVT_TEST_WORKUP_ID = 'svtw-3f2a9c1e-8b4d-4e6f-9a1b-2c3d4e5f6a7b';

/** The invariants the example's request declares, verbatim from its preamble. */
export const SVT_EXAMPLE_INVARIANTS: WorkshopShowVsTellInvariants = {
  mustSurvive: 'the distrust is old and funeral-rooted, and she never says it out loud',
  mustNotChange: 'no flashback; stay in the kitchen, stay in tonight'
};

export interface WireFlag { invariantField: string; kind: string; note: string }
export interface WireVariant {
  prose: string;
  channels: string[];
  gains: string;
  costs: string;
  direction: string;
  invariantFlags: WireFlag[];
}
export interface WireGroup { kind: string; variants: WireVariant[] }
export interface WireResponse { version: number; groups: WireGroup[] }

export const frameShowVsTellResponse = (body: unknown): string =>
  [SHOW_VS_TELL_RESPONSE_START, JSON.stringify(body), SHOW_VS_TELL_RESPONSE_END].join('\n');

/** The example's framed response, exactly as the model is taught to write it. */
export const exampleResponseText = (): string => {
  const lines = fs.readFileSync(EXAMPLE_PATH, 'utf8').split('\n');
  const open = lines.indexOf(SHOW_VS_TELL_RESPONSE_START);
  const close = lines.indexOf(SHOW_VS_TELL_RESPONSE_END);
  if (open < 0 || close !== open + 2) {
    throw new Error('Example response is not framed on its own lines');
  }
  return lines.slice(open, close + 1).join('\n');
};

/** A fresh deep copy of the example's wire JSON, safe to mutate. */
export const exampleWire = (): WireResponse =>
  JSON.parse(exampleResponseText().split('\n')[1]) as WireResponse;
