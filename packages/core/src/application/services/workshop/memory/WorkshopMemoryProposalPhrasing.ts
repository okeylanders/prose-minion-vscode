/**
 * What a project memory may never record (ADR 2026-11-04 D9): an inference
 * about the writer's feelings, health, relationships or private life. The
 * trailer's prompt says so; this host check backs it up. Pure.
 *
 * - It reads only **sentences about the writer**: a sentence of the title,
 *   summary or body that speaks to or of the writer, in the second person
 *   ("you", "your"), as "the writer" or "the author", or by the About-you
 *   name.
 * - It withholds a proposal when such a sentence holds a word from
 *   `WORKSHOP_MEMORY_PERSONAL_WORDS` (feelings, health, relationships,
 *   private life). A withheld proposal shows no card, and its reason is
 *   logged, never its text.
 *
 * **The limits, stated plainly.** This is an English word fence, not a
 * parse, in the style of `LightboxSteeringPhrasing`.
 * - It can't catch every inference: one phrased without a listed word, or
 *   about the writer without naming them ("seems tired lately"), passes.
 * - It never reads characters' feelings, which are legitimate `canon`: a
 *   sentence about Alice is not a sentence about the writer.
 * - A listed word used about the work in a sentence that names the writer
 *   ("you want the family scenes tighter") is withheld. That's the safe
 *   failure; the writer can still save it with Save to memory….
 */

/** Words that mark a personal domain, lower case; a sentence about the writer that holds one is withheld. */
export const WORKSHOP_MEMORY_PERSONAL_WORDS: readonly string[] = Object.freeze([
  // Feelings and mood
  'anxious', 'anxiety', 'depressed', 'depression', 'lonely', 'loneliness', 'grief', 'grieving',
  'insecure', 'insecurity', 'overwhelmed', 'burnout', 'stressed', 'unhappy', 'miserable',
  'feelings', 'emotional', 'emotionally', 'mood', 'moody', 'afraid', 'scared', 'ashamed',
  // Health
  'health', 'healthy', 'illness', 'ill', 'sick', 'diagnosis', 'diagnosed', 'therapy', 'therapist',
  'medication', 'medicated', 'pregnant', 'pregnancy', 'disability', 'disabled', 'chronic',
  'surgery', 'hospital', 'doctor', 'adhd', 'autism', 'autistic', 'insomnia', 'trauma', 'traumatic',
  // Relationships
  'divorce', 'divorced', 'marriage', 'married', 'husband', 'wife', 'spouse', 'boyfriend',
  'girlfriend', 'dating', 'breakup', 'family', 'mother', 'father', 'mom', 'dad', 'kids',
  'children', 'son', 'daughter', 'relationship', 'relationships',
  // Private life
  'religion', 'religious', 'faith', 'politics', 'political', 'debt', 'finances', 'salary',
  'unemployed', 'sexuality', 'sexual', 'private', 'personal'
]);

/** Phrases that mark a sentence as being about the writer. */
const ABOUT_THE_WRITER = /\b(?:you|your|yours|yourself|you're|you've|you'd|you'll)\b|\bthe\s+(?:writer|author)(?:'s)?\b/iu;
const WORD = /[\p{L}]+/gu;
const PERSONAL: ReadonlySet<string> = new Set(WORKSHOP_MEMORY_PERSONAL_WORDS);

export type WorkshopMemoryPhrasingFault = 'personal-inference';

export interface WorkshopMemoryPhrasingInput {
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

/** Why the proposal is withheld, or undefined when it may be shown. */
export function workshopMemoryProposalPhrasingFault(
  proposal: WorkshopMemoryPhrasingInput,
  writerName?: string
): WorkshopMemoryPhrasingFault | undefined {
  const name = writerName?.trim();
  const namePattern = name ? new RegExp(`(?:^|[^\\p{L}])${escapeRegExp(name)}(?:$|[^\\p{L}])`, 'iu') : undefined;
  const sentences = [proposal.title, proposal.summary, proposal.body]
    .flatMap((field) => field.split(/[.!?;\n]+/u));
  for (const sentence of sentences) {
    const folded = sentence.replace(/[’‘]/gu, "'");
    const aboutWriter = ABOUT_THE_WRITER.test(folded) || (namePattern?.test(folded) ?? false);
    if (!aboutWriter) {
      continue;
    }
    if ((folded.toLocaleLowerCase('en-US').match(WORD) ?? []).some((word) => PERSONAL.has(word))) {
      return 'personal-inference';
    }
  }
  return undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
