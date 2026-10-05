/**
 * Visibility witness for every reader of past threads — transcript export
 * today, session recall next (ADR 2026-10-05, Session Transcript Recall I1).
 * Each field the thread does not show carries a unique marker; the projection
 * may emit none of them, while the labels a reader does see survive.
 */

import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { WorkshopTurn } from '@messages';
import { FIXTURE_EPOCH, dividerTurn, fixtureTurn, writerTurn } from './workshopTranscriptFixtures';

const HIDDEN = {
  attachmentId: 'HIDDEN-ATTACHMENT-ID',
  attachmentPath: 'HIDDEN-ATTACHMENT-PATH',
  attachmentResource: 'HIDDEN-ATTACHMENT-RESOURCE',
  widgetConfig: 'HIDDEN-WIDGET-CONFIG',
  widgetArtifact: 'HIDDEN-WIDGET-ARTIFACT',
  evidenceBody: 'HIDDEN-EVIDENCE-BODY',
  evidenceMetadata: 'HIDDEN-EVIDENCE-METADATA',
  analysisMaterial: 'HIDDEN-ANALYSIS-MATERIAL',
  contextChange: 'HIDDEN-CONTEXT-CHANGE',
  finding: 'HIDDEN-FINDING',
  recommendation: 'HIDDEN-RECOMMENDATION',
  directive: 'HIDDEN-DIRECTIVE',
  reportLink: 'HIDDEN-REPORT-LINK',
  directRunRequest: 'HIDDEN-DIRECT-RUN-REQUEST'
} as const;

/** One turn per hiding rule, each with its markers in non-visible fields. */
const roomWithHiddenMaterial = (): WorkshopTurn[] => [
  writerTurn('u-attachment', {
    content: 'Read the letters before you answer.',
    messageAttachments: [{
      id: HIDDEN.attachmentId,
      label: 'letters.md',
      words: 900,
      relativePath: `drafts/${HIDDEN.attachmentPath}.md`,
      configuredResource: { group: 'chapters', path: `chapters/${HIDDEN.attachmentResource}.md` }
    }]
  }),
  writerTurn('u-widget', {
    content: 'Try these variations.',
    widgetCommit: {
      widgetId: 'creative-variations',
      widgetConfigId: HIDDEN.widgetConfig,
      rail: 'thread-artifact',
      artifactId: HIDDEN.widgetArtifact,
      selectionCount: 2
    }
  }),
  fixtureTurn('a-reply', {
    content: 'The letters are about the tide.',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    actionableFindings: [{ key: 'finding-1', text: HIDDEN.finding, ordinal: 1, priority: 'high' }],
    widgetRecommendation: {
      widgetId: 'gesture-playground',
      reason: HIDDEN.recommendation,
      seed: { targetPhrase: HIDDEN.recommendation }
    } as unknown as WorkshopTurn['widgetRecommendation']
  }),
  fixtureTurn('cap-analysis', {
    artifact: 'tool_report',
    participant: 'tool',
    toolId: 'continuity',
    toolLabel: 'Continuity',
    personaId: undefined,
    personaLabel: undefined,
    content: HIDDEN.evidenceBody,
    capability: {
      operation: 'analysis.run',
      status: 'success',
      requestSummary: 'Track the cup.',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' },
      metadata: { toolId: 'continuity', note: HIDDEN.evidenceMetadata }
    },
    analysisInputs: {
      excerpt: { mode: 'replace', material: HIDDEN.analysisMaterial, chosenBy: 'Jill', words: 3 },
      context: { mode: 'omit', material: HIDDEN.analysisMaterial, chosenBy: 'Jill', words: 0 }
    }
  }),
  dividerTurn('c-context', 'context_change', `Context updated: added ${HIDDEN.contextChange}.md`),
  {
    ...dividerTurn('d-directive', 'standing_directive_change', 'Lexical Gravity installed'),
    standingDirectiveChange: {
      action: 'installed',
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      directiveId: HIDDEN.directive,
      widgetConfigId: HIDDEN.widgetConfig,
      revision: 1
    }
  },
  writerTurn('u-direct-run', {
    kind: 'tool_run',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    content: HIDDEN.directRunRequest,
    excerptVersion: 2
  }),
  fixtureTurn('a-report', {
    participant: 'tool',
    artifact: 'tool_report',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined,
    reportTurnId: HIDDEN.reportLink,
    content: 'Report body.'
  })
];

const project = () =>
  projectWorkshopTranscript(roomWithHiddenMaterial(), { title: 'Hidden material', exportedAt: FIXTURE_EPOCH });

describe('projectWorkshopTranscript visibility', () => {
  it.each(Object.entries(HIDDEN))('never emits the %s the thread hides', (_field, marker) => {
    expect(JSON.stringify(project())).not.toContain(marker);
  });

  it('still emits the labels and lines a reader sees', () => {
    const entries = project().entries;

    expect(entries.find((entry) => entry.turnId === 'u-attachment'))
      .toMatchObject({ kind: 'writer', attachmentLabels: ['letters.md'] });
    expect(entries.find((entry) => entry.turnId === 'u-widget'))
      .toMatchObject({ kind: 'writer', widget: { label: 'Creative Variations Explorer' } });
    expect(entries.find((entry) => entry.turnId === 'cap-analysis')).toMatchObject({
      kind: 'event',
      text: 'Continuity · Track the cup. · requested by Jill · success'
    });
    expect(entries.find((entry) => entry.turnId === 'd-directive'))
      .toMatchObject({ kind: 'event', text: 'Lexical Gravity installed' });
    expect(entries.find((entry) => entry.turnId === 'u-direct-run'))
      .toMatchObject({ kind: 'event', text: 'Prose Assistant · direct run · excerpt v2' });
  });
});
