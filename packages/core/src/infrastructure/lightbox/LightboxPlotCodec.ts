/**
 * Group E's blocks: template and freshness, pressure, artifacts, summary and
 * movements (ADR 2026-10-19 D7 and its 2026-10-20 addendum; Slice 4C). Pure:
 * no host, no I/O. Called by `LightboxReadingCodec` once the block's
 * friction is known; a throw here withholds the whole block, and an item
 * that breaks its own rules is withheld by its title (a host title, its noun
 * and position, where the item has none of its own).
 *
 * Counts and lengths the prompt states are asks (Slice 4H): more beats,
 * threads, objects, steps, movements or synopsis sentences than asked are
 * read and shown. Rules enforced here, not only asked for in the prompt:
 * - **Template.** A name, a description with 1–3 quotes, beats whose
 *   stance is aligns, subverts or departs, and a freshness reading on the
 *   three-step scale with a note. Engagement entries name a movement by the
 *   response's own key with a level in its vocabulary; whether they match
 *   the movements is checked once the summary is assembled. An engagement
 *   list that breaks the format is kept as a fault, withholding engagement
 *   alone, never the template.
 * - **Pressure.** Each thread names a question or event, a planted quote,
 *   0–3 escalations, a resolution or `null`, and a dormant flag. A dormant
 *   thread is planted and never touched again: one that gives an escalation
 *   or a resolution is withheld (the flag is read; its consistency is
 *   checked). Paragraph order is the chapter's question, checked afterwards.
 * - **Artifacts.** Each object names its terms for the host to count and an
 *   arc of 1–5 quoted steps; "planted, unused" is a boolean the host checks
 *   against its counts afterwards.
 * - **Summary.** A synopsis with at least two quotes (its length and its
 *   sentences are asks); a synopsis that breaks the format is kept as a
 *   fault, withholding it alone. Movements: at least one, each with a short
 *   key unique in the block, a title, a range, a gist and a boundary quote;
 *   one that breaks the format is withheld by title, which withholds the
 *   set, since the rest no longer tile the chapter.
 * Every object decodes with `strictObject`: a field the format does not
 * define is counted, never named, and every reason is host-owned. The model
 * never supplies a count: no field carries one.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { shapeError } from '@/application/services/workshop/persistedValidation';
import {
  decodeItems,
  evidence,
  listAt,
  oneOf,
  paragraphNumber,
  singleQuote,
  strictObject,
  terms,
  prose,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import type { LightboxWireQuote } from '@/infrastructure/lightbox/LightboxReadingWire';
import {
  LIGHTBOX_ENGAGEMENT_READINGS,
  LIGHTBOX_FRESHNESS_READINGS,
  LIGHTBOX_MOVEMENT_ID,
  LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES,
  LIGHTBOX_TEMPLATE_STANCES,
  lightboxMovementKey,
  type LightboxDecodedArtifact,
  type LightboxDecodedArtifactsBlock,
  type LightboxDecodedEngagement,
  type LightboxDecodedMovement,
  type LightboxDecodedPressureBlock,
  type LightboxDecodedSummaryBlock,
  type LightboxDecodedTemplateBeat,
  type LightboxDecodedTemplateBlock,
  type LightboxDecodedThread
} from '@/infrastructure/lightbox/LightboxPlotWire';

const B = PROMPT_BUDGETS.lightbox;

export function decodeTemplateBlock(value: unknown, path: string, friction: string): LightboxDecodedTemplateBlock {
  const block = strictObject(value, path, ['name', 'description', 'evidence', 'beats', 'freshness', 'engagement', 'friction']);
  const freshness = strictObject(block.freshness, `${path}.freshness`, ['level', 'note']);
  const beats = decodeItems(block.beats, `${path}.beats`, 'template beat', decodeBeat);
  const engagement = lenient(() => decodeEngagement(block.engagement, `${path}.engagement`));
  return {
    lens: 'template',
    name: text(block.name, `${path}.name`),
    description: prose(block.description, `${path}.description`, B.claimCharacters),
    evidence: evidence(block.evidence, `${path}.evidence`, 1),
    beats: beats.items,
    freshness: {
      level: oneOf(freshness.level, `${path}.freshness.level`, LIGHTBOX_FRESHNESS_READINGS, 'familiar, mixed or fresh'),
      note: prose(freshness.note, `${path}.freshness.note`, B.noteCharacters)
    },
    engagement: 'value' in engagement ? engagement.value : [],
    ...('fault' in engagement ? { engagementFault: engagement.fault } : {}),
    malformed: beats.malformed,
    friction
  };
}

export function decodePressureBlock(value: unknown, path: string, friction: string): LightboxDecodedPressureBlock {
  const block = strictObject(value, path, ['threads', 'friction']);
  const threads = decodeItems(block.threads, `${path}.threads`, 'thread', decodeThread);
  return { lens: 'pressure', threads: threads.items, malformed: threads.malformed, friction };
}

export function decodeArtifactsBlock(value: unknown, path: string, friction: string): LightboxDecodedArtifactsBlock {
  const block = strictObject(value, path, ['objects', 'friction']);
  const objects = decodeItems(block.objects, `${path}.objects`, 'object', decodeArtifact);
  return { lens: 'artifacts', objects: objects.items, malformed: objects.malformed, friction };
}

export function decodeSummaryBlock(value: unknown, path: string, friction: string): LightboxDecodedSummaryBlock {
  const block = strictObject(value, path, ['synopsis', 'movements', 'friction']);
  const synopsis = lenient(() => decodeSynopsis(block.synopsis, `${path}.synopsis`));
  const decoded = decodeItems(block.movements, `${path}.movements`, 'movement', decodeMovement, 1);
  // A key names one movement: a second movement under the same key is malformed.
  const seen = new Set<string>();
  const movements = decoded.items.filter((movement, index) => {
    const key = lightboxMovementKey(movement.id);
    if (seen.has(key)) {
      decoded.malformed.push({ title: `Movement ${index + 1}`, reason: 'Another movement in this block already has that id.' });
      return false;
    }
    seen.add(key);
    return true;
  });
  return {
    lens: 'summary',
    synopsis: 'value' in synopsis ? synopsis.value : { text: '', evidence: [] },
    ...('fault' in synopsis ? { synopsisFault: synopsis.fault } : {}),
    movements,
    malformed: decoded.malformed,
    friction
  };
}

function decodeBeat(item: Record<string, unknown>, path: string): LightboxDecodedTemplateBeat {
  const beat = strictObject(item, path, ['stance', 'note', 'evidence']);
  return {
    stance: oneOf(beat.stance, `${path}.stance`, LIGHTBOX_TEMPLATE_STANCES, 'aligns, subverts or departs'),
    note: prose(beat.note, `${path}.note`, B.noteCharacters),
    evidence: evidence(beat.evidence, `${path}.evidence`, 1)
  };
}

function decodeEngagement(value: unknown, path: string): LightboxDecodedEngagement[] {
  // One entry per movement is checked against the movements drawn (`LightboxPlotGates`), never by the list's length here.
  listAt(value, path, 0, 'engagement entries, one per movement');
  return value.map((item, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = strictObject(item, entryPath, ['movement', 'level']);
    return {
      movement: movementId(entry.movement, `${entryPath}.movement`),
      level: oneOf(entry.level, `${entryPath}.level`, LIGHTBOX_ENGAGEMENT_READINGS, 'low, medium or high')
    };
  });
}

function decodeThread(item: Record<string, unknown>, path: string): LightboxDecodedThread {
  const thread = strictObject(item, path, ['question', 'planted', 'escalations', 'resolution', 'dormant']);
  listAt(thread.escalations, `${path}.escalations`, 0, 'escalations');
  const escalations = thread.escalations.map((quote, index) => singleQuote(quote, `${path}.escalations[${index}]`));
  const resolution = thread.resolution === null ? null : singleQuote(thread.resolution, `${path}.resolution`);
  if (typeof thread.dormant !== 'boolean') {
    shapeError(`${path}.dormant`, 'true or false');
  }
  const dormant = thread.dormant as boolean;
  if (dormant && (escalations.length > 0 || resolution !== null)) {
    throw new Error('A dormant thread is planted and never touched again, so it gives no escalation and no resolution; this one does.');
  }
  return {
    question: text(thread.question, `${path}.question`),
    planted: singleQuote(thread.planted, `${path}.planted`),
    escalations,
    resolution,
    dormant
  };
}

function decodeArtifact(item: Record<string, unknown>, path: string): LightboxDecodedArtifact {
  const artifact = strictObject(item, path, ['name', 'terms', 'arc', 'plantedUnused']);
  listAt(artifact.arc, `${path}.arc`, 1, 'steps');
  if (typeof artifact.plantedUnused !== 'boolean') {
    shapeError(`${path}.plantedUnused`, 'true or false');
  }
  return {
    name: text(artifact.name, `${path}.name`),
    terms: terms(artifact.terms, `${path}.terms`),
    arc: artifact.arc.map((entry, index) => {
      const stepPath = `${path}.arc[${index}]`;
      const step = strictObject(entry, stepPath, ['step', 'para', 'quote']);
      return {
        step: text(step.step, `${stepPath}.step`),
        para: paragraphNumber(step.para, `${stepPath}.para`),
        quote: text(step.quote, `${stepPath}.quote`)
      };
    }),
    plantedUnused: artifact.plantedUnused as boolean
  };
}

function decodeSynopsis(value: unknown, path: string): { text: string; evidence: LightboxWireQuote[] } {
  const synopsis = strictObject(value, path, ['text', 'evidence']);
  // Its characters and sentences are asks: a longer synopsis is shown whole (Slice 4H).
  const body = prose(synopsis.text, `${path}.text`, B.claimCharacters);
  return { text: body, evidence: evidence(synopsis.evidence, `${path}.evidence`, LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES) };
}

function decodeMovement(item: Record<string, unknown>, path: string): LightboxDecodedMovement {
  const movement = strictObject(item, path, ['id', 'title', 'from', 'to', 'gist', 'boundary']);
  return {
    id: movementId(movement.id, `${path}.id`),
    title: text(movement.title, `${path}.title`),
    from: paragraphNumber(movement.from, `${path}.from`),
    to: paragraphNumber(movement.to, `${path}.to`),
    gist: prose(movement.gist, `${path}.gist`, B.noteCharacters),
    boundary: singleQuote(movement.boundary, `${path}.boundary`)
  };
}

function movementId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !LIGHTBOX_MOVEMENT_ID.test(value)) {
    shapeError(path, 'a movement id: 1 to 12 letters, digits or hyphens');
  }
  return value as string;
}


/** A part decoded on its own: its value, or its fault in host words, so it withholds only itself. */
function lenient<T>(decode: () => T): { value: T } | { fault: string } {
  try {
    return { value: decode() };
  } catch (error) {
    return { fault: `It broke the format: ${error instanceof Error ? error.message : String(error)}` };
  }
}
