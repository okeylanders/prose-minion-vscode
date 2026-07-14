/** Deterministic extraction of writer-promotable findings from Workshop turns. */

import { WorkshopActionableFinding } from '@messages';

export const WORKSHOP_ACTIONABLE_FINDING_BOUNDS = Object.freeze({
  sectionCharacters: 6_000,
  items: 12,
  itemCharacters: 500
});

export const WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION = [
  '<workshop-actionable-findings-contract>',
  'When your report contains concrete actions the writer could deliberately add to a task list, end with exactly `### Next steps` and one single-line `- ` list item per action. You may prefix an item with exactly `[high]`, `[medium]`, or `[low]` when the report supports a priority.',
  'Keep each item specific and attributable to evidence in this report. Omit the section when there are no concrete actions. Do not use nested or multiline list items.',
  '</workshop-actionable-findings-contract>'
].join('\n');

const NEXT_STEPS_HEADING = '### Next steps';
const LIST_ITEM = /^[-*+]\s+(?:\[(high|medium|low)\]\s+)?(.+)$/;
const UNSUPPORTED_BRACKET_PREFIX = /^\[[^\]]*\]\s+/;
const ANY_HEADING = /^#{1,6}\s+/;

export type WorkshopActionableFindingsRejection =
  | 'duplicate_heading'
  | 'section_too_large'
  | 'empty_or_too_many_items'
  | 'invalid_item';

export type WorkshopActionableFindingsInspection =
  | {
      outcome: 'absent';
      findings: WorkshopActionableFinding[];
    }
  | {
      outcome: 'accepted';
      findings: WorkshopActionableFinding[];
    }
  | {
      outcome: 'rejected';
      findings: WorkshopActionableFinding[];
      rejection: WorkshopActionableFindingsRejection;
    };

/**
 * Parse one exact `### Next steps` section containing only single-line
 * unordered Markdown items. Any malformed or oversized section is rejected
 * wholesale: partial model output must not quietly become writer state.
 */
export function inspectWorkshopActionableFindings(
  report: string
): WorkshopActionableFindingsInspection {
  const lines = report.replace(/\r\n?/g, '\n').split('\n');
  const headingIndexes = lines.flatMap((line, index) =>
    line.trim() === NEXT_STEPS_HEADING ? [index] : []
  );
  if (headingIndexes.length === 0) {
    return { outcome: 'absent', findings: [] };
  }
  if (headingIndexes.length > 1) {
    return { outcome: 'rejected', findings: [], rejection: 'duplicate_heading' };
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
    return { outcome: 'rejected', findings: [], rejection: 'section_too_large' };
  }

  const meaningfulLines = sectionLines.filter((line) => line.trim().length > 0);
  if (
    meaningfulLines.length === 0 ||
    meaningfulLines.length > WORKSHOP_ACTIONABLE_FINDING_BOUNDS.items
  ) {
    return { outcome: 'rejected', findings: [], rejection: 'empty_or_too_many_items' };
  }

  const findings: WorkshopActionableFinding[] = [];
  const seen = new Set<string>();
  for (const line of meaningfulLines) {
    const match = LIST_ITEM.exec(line);
    const priority = match?.[1] as WorkshopActionableFinding['priority'];
    const text = match?.[2]?.trim();
    if (
      !text ||
      (!priority && UNSUPPORTED_BRACKET_PREFIX.test(text)) ||
      text.length > WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters ||
      seen.has(text)
    ) {
      return { outcome: 'rejected', findings: [], rejection: 'invalid_item' };
    }
    const ordinal = findings.length + 1;
    findings.push({
      key: `finding-${ordinal}`,
      text,
      ordinal,
      ...(priority ? { priority } : {})
    });
    seen.add(text);
  }

  return { outcome: 'accepted', findings };
}

/**
 * Compatibility convenience for consumers that only need the trusted
 * findings. Callers that need an audit trail should use the inspection result.
 */
export function extractWorkshopActionableFindings(
  report: string
): WorkshopActionableFinding[] {
  return inspectWorkshopActionableFindings(report).findings;
}
