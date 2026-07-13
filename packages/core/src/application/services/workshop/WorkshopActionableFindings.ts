/** Deterministic extraction of writer-promotable findings from tool reports. */

import { WorkshopActionableFinding } from '@messages';

export const WORKSHOP_ACTIONABLE_FINDING_BOUNDS = Object.freeze({
  sectionCharacters: 6_000,
  items: 12,
  itemCharacters: 500
});

export const WORKSHOP_TODO_BOUNDS = Object.freeze({
  items: 200,
  textCharacters: WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters
});

export const WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION = [
  '<workshop-actionable-findings-contract>',
  'When your report contains concrete actions the writer could deliberately add to a task list, end with exactly `### Next steps` and one single-line `- ` list item per action.',
  'Keep each item specific and attributable to evidence in this report. Omit the section when there are no concrete actions. Do not use nested or multiline list items.',
  '</workshop-actionable-findings-contract>'
].join('\n');

const NEXT_STEPS_HEADING = '### Next steps';
const LIST_ITEM = /^[-*+]\s+(.+)$/;
const ANY_HEADING = /^#{1,6}\s+/;

/**
 * Parse one exact `### Next steps` section containing only single-line
 * unordered Markdown items. Any malformed or oversized section is rejected
 * wholesale: partial model output must not quietly become writer state.
 */
export function extractWorkshopActionableFindings(
  report: string
): WorkshopActionableFinding[] {
  const lines = report.replace(/\r\n?/g, '\n').split('\n');
  const headingIndexes = lines.flatMap((line, index) =>
    line.trim() === NEXT_STEPS_HEADING ? [index] : []
  );
  if (headingIndexes.length !== 1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndexes[0] + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (ANY_HEADING.test(line.trim())) {
      break;
    }
    sectionLines.push(line);
  }

  const section = sectionLines.join('\n');
  if (section.length > WORKSHOP_ACTIONABLE_FINDING_BOUNDS.sectionCharacters) {
    return [];
  }

  const meaningfulLines = sectionLines.filter((line) => line.trim().length > 0);
  if (
    meaningfulLines.length === 0 ||
    meaningfulLines.length > WORKSHOP_ACTIONABLE_FINDING_BOUNDS.items
  ) {
    return [];
  }

  const findings: WorkshopActionableFinding[] = [];
  const seen = new Set<string>();
  for (const line of meaningfulLines) {
    const match = LIST_ITEM.exec(line);
    const text = match?.[1]?.trim();
    if (
      !text ||
      text.length > WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters ||
      seen.has(text)
    ) {
      return [];
    }
    const ordinal = findings.length + 1;
    findings.push({ key: `finding-${ordinal}`, text, ordinal });
    seen.add(text);
  }

  return findings;
}
