/**
 * What a project memory may never record (ADR 2026-11-04 D9, amended
 * 2026-11-11): an inference about the writer's feelings, health,
 * relationships or private life. The trailer's prompt says so; this host
 * check is a second pair of eyes, never a gate. Pure.
 *
 * - It reads only **sentences about the writer**: a sentence of the title,
 *   summary or body that speaks to or of the writer, in the second person
 *   ("you", "your"), as "the writer" or "the author", or by the About-you
 *   name.
 * - It **flags** a proposal when such a sentence holds a word from
 *   `WORKSHOP_MEMORY_PERSONAL_WORDS` (feelings, health, relationships,
 *   private life), and names the first word it matched. A flagged proposal
 *   is held `personal` (D8): its card shows, under Ask first and Save and
 *   tell me alike, with the word in its reason, and it is never saved
 *   automatically. The log carries the reason, never the word or the text.
 *
 * **The limits, stated plainly.** This is an English word fence, not a
 * parse, in the style of `LightboxSteeringPhrasing`.
 * - It can't catch every inference: one phrased without a listed word, or
 *   about the writer without naming them ("seems tired lately"), passes.
 * - It never reads characters' feelings, which are legitimate `canon`: a
 *   sentence about Alice is not a sentence about the writer.
 * - A listed word used about the work in a sentence that names the writer
 *   ("you want the family scenes tighter", "you've kept Alice's family
 *   quarrel unresolved") is flagged. Fiction's vocabulary is this list's
 *   vocabulary, so that happens often: the writer reads the card and
 *   decides. That's why a flag holds and never withholds (2026-11-11): a
 *   withheld note vanished, and neither the writer nor the persona knew.
 */

/** Words that mark a personal domain, lower case; a sentence about the writer that holds one is flagged. */
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

/** What the fence flagged: the fault, for the log, and the listed word it matched, for the writer's card only. */
export interface WorkshopMemoryPhrasingFlag {
  readonly fault: WorkshopMemoryPhrasingFault;
  /** Lower case, one of `WORKSHOP_MEMORY_PERSONAL_WORDS`. Never logged. */
  readonly word: string;
}

export interface WorkshopMemoryPhrasingInput {
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

/** Why the proposal waits for the writer, and the word that matched, or undefined when nothing was flagged. */
export function workshopMemoryProposalPhrasingFlag(
  proposal: WorkshopMemoryPhrasingInput,
  writerName?: string
): WorkshopMemoryPhrasingFlag | undefined {
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
    const word = (folded.toLocaleLowerCase('en-US').match(WORD) ?? []).find((candidate) => PERSONAL.has(candidate));
    if (word !== undefined) {
      return { fault: 'personal-inference', word };
    }
  }
  return undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
