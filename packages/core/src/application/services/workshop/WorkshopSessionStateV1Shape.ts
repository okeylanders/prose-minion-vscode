/**
 * Exact structural grammar for WorkshopSessionStateV1.
 *
 * This module answers only "does this raw value have the frozen V1 shape?".
 * Cross-reference and counter invariants live in the sibling integrity module.
 */

import {
  isHttpUrl,
  isWorkshopInteractionMode,
  isWorkshopPersonaExpressionLevel,
  isWorkshopRelationalDepth,
  isWorkshopSessionScope
} from '@messages';
import { isContextPathGroup } from '@shared/types';
import {
  isWorkshopPersonaId,
  WORKSHOP_GUEST_CAPACITY
} from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import {
  isLiveWorkshopWidgetId,
  isWorkshopWidgetId,
  workshopWidgetIdFromArtifactKind
} from '@shared/constants/workshopWidgets';
import {
  WORKSHOP_TODO_BOUNDS
} from '@/application/services/workshop/WorkshopSessionLimits';
import {
  arrayOf,
  booleanAt,
  enumAt,
  exactKeys,
  exactObject,
  jsonObjectAt,
  numberAt,
  objectAt,
  optionalBooleanAt,
  optionalNumberAt,
  optionalStringAt,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  assertGesturePlaygroundRecommendationSeedShape
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec';
import {
  assertLexicalGravityRecommendationSeedShape
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  assertWorkshopWidgetCheckpointDraftShape,
  assertWorkshopWidgetCurrentDraftShape,
  isPersistedWorkshopWidgetId
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';

export function assertWorkshopSessionStateShape(
  value: unknown
): asserts value is WorkshopSessionStateV1 {
  assertWorkshopSessionShape(value, false);
}

export function assertWorkshopSessionCheckpointShape(
  value: unknown
): asserts value is WorkshopSessionStateV1 {
  assertWorkshopSessionShape(value, true);
}

function assertWorkshopSessionShape(
  value: unknown,
  checkpoint: boolean
): asserts value is WorkshopSessionStateV1 {
  const state = exactObject(
    value,
    'Workshop session state',
    [
      'contextAttachments',
      'pendingMessageAttachments',
      'revisions',
      'counters',
      'writerSources',
      'turns',
      'participants',
      'todos'
    ],
    [
      'excerpt',
      'scope',
      'shelvedExcerpt',
      'selectedToolId',
      'lastCommittedPersonaBehavior',
      // Optional since ADR 2026-07-22: pre-widget checkpoints have none.
      'widgetConfigs',
      // Optional since Sprint 02B: pre-directive checkpoints have none.
      'standingDirectives',
      // Optional: pre-room-artifact-ledger checkpoints retain refs only.
      'threadArtifacts'
    ]
  );
  if (state.excerpt !== undefined) {
    assertExcerpt(state.excerpt, 'Workshop session state.excerpt');
  }
  if (state.scope !== undefined && !isWorkshopSessionScope(state.scope)) {
    shapeError('Workshop session state.scope', 'excerpt, open, or null');
  }
  if (state.shelvedExcerpt !== undefined) {
    assertExcerpt(state.shelvedExcerpt, 'Workshop session state.shelvedExcerpt');
  }
  arrayOf(state.contextAttachments, 'Workshop session state.contextAttachments', assertContextAttachment);
  arrayOf(
    state.pendingMessageAttachments,
    'Workshop session state.pendingMessageAttachments',
    assertMessageAttachment
  );
  assertRevisions(state.revisions);
  assertCounters(state.counters);
  assertWriterSources(state.writerSources);
  arrayOf(state.turns, 'Workshop session state.turns', assertTurn);
  assertParticipants(state.participants);
  if (state.selectedToolId !== undefined && !isWorkshopToolId(state.selectedToolId)) {
    shapeError('Workshop session state.selectedToolId', 'known Workshop tool id');
  }
  arrayOf(state.todos, 'Workshop session state.todos', assertStoredTodo);
  if (state.widgetConfigs !== undefined) {
    arrayOf(
      state.widgetConfigs,
      'Workshop session state.widgetConfigs',
      (config, path) => assertWidgetConfig(config, path, checkpoint)
    );
  }
  if (state.standingDirectives !== undefined) {
    arrayOf(
      state.standingDirectives,
      'Workshop session state.standingDirectives',
      assertStandingDirective
    );
  }
  if (state.threadArtifacts !== undefined) {
    arrayOf(
      state.threadArtifacts,
      'Workshop session state.threadArtifacts',
      assertThreadArtifact
    );
  }
  if (state.lastCommittedPersonaBehavior !== undefined) {
    assertLastCommittedBehavior(
      state.lastCommittedPersonaBehavior,
      'Workshop session state.lastCommittedPersonaBehavior'
    );
  }
}

function assertThreadArtifact(value: unknown, path: string): void {
  const artifact = exactObject(
    value,
    path,
    ['id', 'turnId', 'name', 'content'],
    ['kind', 'sourcePath', 'truncation']
  );
  stringAt(artifact.id, `${path}.id`);
  stringAt(artifact.turnId, `${path}.turnId`);
  stringAt(artifact.name, `${path}.name`);
  stringAt(artifact.content, `${path}.content`);
  optionalStringAt(artifact.sourcePath, `${path}.sourcePath`);
  if (
    artifact.kind !== undefined
    && (
      typeof artifact.kind !== 'string'
      || workshopWidgetIdFromArtifactKind(artifact.kind) === undefined
    )
  ) {
    shapeError(`${path}.kind`, 'widget:<registry id>');
  }
  if (artifact.truncation !== undefined) {
    const truncation = exactObject(
      artifact.truncation,
      `${path}.truncation`,
      ['keptWords', 'totalWords']
    );
    numberAt(truncation.keptWords, `${path}.truncation.keptWords`);
    numberAt(truncation.totalWords, `${path}.truncation.totalWords`);
  }
}

function assertExcerpt(value: unknown, path: string): void {
  const excerpt = exactObject(
    value,
    path,
    ['text', 'version', 'source', 'pinnedAt'],
    ['truncation', 'sourceFingerprint']
  );
  stringAt(excerpt.text, `${path}.text`);
  numberAt(excerpt.version, `${path}.version`);
  assertExcerptSource(excerpt.source, `${path}.source`);
  numberAt(excerpt.pinnedAt, `${path}.pinnedAt`);
  if (excerpt.truncation !== undefined) {
    const truncation = exactObject(
      excerpt.truncation,
      `${path}.truncation`,
      ['pinnedWords', 'totalWords']
    );
    numberAt(truncation.pinnedWords, `${path}.truncation.pinnedWords`);
    numberAt(truncation.totalWords, `${path}.truncation.totalWords`);
  }
  optionalStringAt(excerpt.sourceFingerprint, `${path}.sourceFingerprint`);
}

function assertExcerptSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  if (source.kind === 'manual') {
    exactKeys(source, path, ['kind']);
    return;
  }
  if (source.kind === 'file') {
    exactKeys(source, path, ['kind', 'sourceUri', 'relativePath'], ['configuredResource']);
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  if (source.kind === 'editor-selection') {
    exactKeys(
      source,
      path,
      ['kind', 'sourceUri', 'relativePath'],
      ['startLine', 'endLine', 'configuredResource']
    );
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    optionalNumberAt(source.startLine, `${path}.startLine`);
    optionalNumberAt(source.endLine, `${path}.endLine`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  shapeError(`${path}.kind`, 'manual, file, or editor-selection');
}

function assertContextAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'kind', 'origin', 'label', 'words', 'content', 'addedAt'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  enumAt(attachment.kind, `${path}.kind`, ['text', 'file']);
  enumAt(attachment.origin, `${path}.origin`, ['writer', 'wizard']);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  numberAt(attachment.addedAt, `${path}.addedAt`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertMessageAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words', 'content'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertKeptWordTruncation(value: unknown, path: string): void {
  const truncation = exactObject(value, path, ['keptWords', 'totalWords']);
  numberAt(truncation.keptWords, `${path}.keptWords`);
  numberAt(truncation.totalWords, `${path}.totalWords`);
}

function assertOptionalConfiguredResource(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  const resource = exactObject(value, path, ['group', 'path']);
  if (typeof resource.group !== 'string' || !isContextPathGroup(resource.group)) {
    shapeError(`${path}.group`, 'known context resource group');
  }
  stringAt(resource.path, `${path}.path`);
}

function assertRevisions(value: unknown): void {
  const revisions = exactObject(
    value,
    'Workshop session state.revisions',
    ['excerpt', 'replacementCount', 'context'],
    [
      'pendingExcerpt',
      // Legacy, retired by ADR 2026-07-25. Still accepted so pre-lock
      // checkpoints parse; discarded on hydrate, never written again.
      'pendingExcerptChange',
      'pendingExcerptWithdrawal',
      'pendingContext'
    ]
  );
  numberAt(revisions.excerpt, 'Workshop session state.revisions.excerpt');
  numberAt(revisions.replacementCount, 'Workshop session state.revisions.replacementCount');
  numberAt(revisions.context, 'Workshop session state.revisions.context');
  optionalNumberAt(revisions.pendingExcerpt, 'Workshop session state.revisions.pendingExcerpt');
  if (revisions.pendingExcerptChange !== undefined) {
    enumAt(
      revisions.pendingExcerptChange,
      'Workshop session state.revisions.pendingExcerptChange',
      ['revised', 'added', 'repinned']
    );
  }
  if (
    revisions.pendingExcerptWithdrawal !== undefined &&
    revisions.pendingExcerptWithdrawal !== true
  ) {
    shapeError('Workshop session state.revisions.pendingExcerptWithdrawal', 'true when present');
  }
  optionalNumberAt(revisions.pendingContext, 'Workshop session state.revisions.pendingContext');
}

function assertCounters(value: unknown): void {
  const counters = exactObject(
    value,
    'Workshop session state.counters',
    ['attachment', 'threadArtifact', 'turn', 'todo'],
    // Optional since ADR 2026-07-22: pre-widget checkpoints have none.
    ['widgetConfig', 'standingDirective']
  );
  numberAt(counters.attachment, 'Workshop session state.counters.attachment');
  numberAt(counters.threadArtifact, 'Workshop session state.counters.threadArtifact');
  numberAt(counters.turn, 'Workshop session state.counters.turn');
  numberAt(counters.todo, 'Workshop session state.counters.todo');
  optionalNumberAt(counters.widgetConfig, 'Workshop session state.counters.widgetConfig');
  optionalNumberAt(
    counters.standingDirective,
    'Workshop session state.counters.standingDirective'
  );
}

function assertWidgetConfig(value: unknown, path: string, checkpoint: boolean): void {
  const config = exactObject(
    value,
    path,
    ['id', 'widgetId', 'revision', 'draft', 'createdAt'],
    ['clonedFromConfigId', 'committedTurnId', 'artifactId', 'directiveId']
  );
  stringAt(config.id, `${path}.id`);
  if (!isWorkshopWidgetId(config.widgetId)) {
    shapeError(`${path}.widgetId`, 'known Conversation Widget id');
  }
  numberAt(config.revision, `${path}.revision`);
  numberAt(config.createdAt, `${path}.createdAt`);
  optionalStringAt(config.clonedFromConfigId, `${path}.clonedFromConfigId`);
  optionalStringAt(config.committedTurnId, `${path}.committedTurnId`);
  optionalStringAt(config.artifactId, `${path}.artifactId`);
  optionalStringAt(config.directiveId, `${path}.directiveId`);
  if (!isPersistedWorkshopWidgetId(config.widgetId)) {
    shapeError(`${path}.widgetId`, 'a widget with a persisted config codec');
  }
  if (checkpoint) {
    assertWorkshopWidgetCheckpointDraftShape(config.widgetId, config.draft, `${path}.draft`);
  } else {
    assertWorkshopWidgetCurrentDraftShape(config.widgetId, config.draft, `${path}.draft`);
  }
}

function assertStandingDirective(value: unknown, path: string): void {
  const directive = exactObject(
    value,
    path,
    ['id', 'family', 'widgetId', 'widgetConfigId', 'revision', 'updatedAt']
  );
  stringAt(directive.id, `${path}.id`);
  enumAt(directive.family, `${path}.family`, ['lexical-gravity', 'prose-controller']);
  enumAt(directive.widgetId, `${path}.widgetId`, ['lexical-gravity', 'prose-controller']);
  stringAt(directive.widgetConfigId, `${path}.widgetConfigId`);
  numberAt(directive.revision, `${path}.revision`);
  numberAt(directive.updatedAt, `${path}.updatedAt`);
}

function assertWriterSources(value: unknown): void {
  const sources = exactObject(
    value,
    'Workshop session state.writerSources',
    ['host', 'tools', 'guests']
  );
  arrayOf(sources.host, 'Workshop session state.writerSources.host', assertContextSource);
  const tools = objectAt(sources.tools, 'Workshop session state.writerSources.tools');
  for (const [toolId, entries] of Object.entries(tools)) {
    if (!isWorkshopToolId(toolId)) {
      shapeError(`Workshop session state.writerSources.tools.${toolId}`, 'known Workshop tool id');
    }
    arrayOf(
      entries,
      `Workshop session state.writerSources.tools.${toolId}`,
      assertContextSource
    );
  }
  arrayOf(
    sources.guests,
    'Workshop session state.writerSources.guests',
    (guestValue, guestPath) => {
      const guest = exactObject(guestValue, guestPath, ['personaId', 'sources']);
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      arrayOf(guest.sources, `${guestPath}.sources`, assertContextSource);
    }
  );
}

function assertContextSource(value: unknown, path: string): void {
  const source = exactObject(
    value,
    path,
    ['kind', 'origin', 'label', 'sizeChars', 'isEstimate', 'deliveredAt'],
    [
      'configuredResource',
      'promptTokensDelta',
      'excerptVersion',
      'stale',
      'artifactId'
    ]
  );
  enumAt(
    source.kind,
    `${path}.kind`,
    ['pin', 'attachment', 'message-attachment', 'resource', 'tool-evidence', 'dictionary']
  );
  enumAt(source.origin, `${path}.origin`, ['writer', 'host', 'tool']);
  stringAt(source.label, `${path}.label`);
  numberAt(source.sizeChars, `${path}.sizeChars`);
  booleanAt(source.isEstimate, `${path}.isEstimate`);
  numberAt(source.deliveredAt, `${path}.deliveredAt`);
  assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
  optionalNumberAt(source.promptTokensDelta, `${path}.promptTokensDelta`);
  optionalNumberAt(source.excerptVersion, `${path}.excerptVersion`);
  optionalBooleanAt(source.stale, `${path}.stale`);
  optionalStringAt(source.artifactId, `${path}.artifactId`);
}

function assertTurn(value: unknown, path: string): void {
  const turn = exactObject(
    value,
    path,
    ['id', 'role', 'kind', 'participant', 'artifact', 'excerptVersion', 'content', 'timestamp'],
    [
      'toolId',
      'toolLabel',
      'personaId',
      'personaLabel',
      'reportTurnId',
      'capability',
      'analysisInputs',
      'actionableFindings',
      'messageAttachments',
      'usage',
      'citations',
      'truncated',
      'behavior',
      'behaviorTransition',
      // Conversation Widgets (ADR 2026-07-22).
      'widgetCommit',
      'widgetRecommendation',
      'standingDirectiveChange'
    ]
  );
  stringAt(turn.id, `${path}.id`);
  enumAt(turn.role, `${path}.role`, ['user', 'assistant', 'system']);
  enumAt(turn.kind, `${path}.kind`, ['tool_run', 'message', 'divider']);
  enumAt(turn.participant, `${path}.participant`, ['writer', 'host', 'guest', 'tool', 'session']);
  enumAt(
    turn.artifact,
    `${path}.artifact`,
    [
      'tool_request',
      'persona_message',
      'tool_report',
      'persona_synthesis',
      'direct_tool_message',
      'direct_tool_response',
      'dictionary_lookup',
      'dictionary_full_entry',
      'resource_catalog',
      'resource_search',
      'resource_read',
      'excerpt_revision',
      'context_change',
      'standing_directive_change',
      'session_start',
      'session_resume',
      'scope_change'
    ]
  );
  numberAt(turn.excerptVersion, `${path}.excerptVersion`);
  stringAt(turn.content, `${path}.content`);
  numberAt(turn.timestamp, `${path}.timestamp`);
  if (turn.toolId !== undefined && !isWorkshopToolId(turn.toolId)) {
    shapeError(`${path}.toolId`, 'known Workshop tool id');
  }
  optionalStringAt(turn.toolLabel, `${path}.toolLabel`);
  if (turn.personaId !== undefined && !isWorkshopPersonaId(turn.personaId)) {
    shapeError(`${path}.personaId`, 'known Workshop persona id');
  }
  optionalStringAt(turn.personaLabel, `${path}.personaLabel`);
  optionalStringAt(turn.reportTurnId, `${path}.reportTurnId`);
  if (turn.capability !== undefined) {
    assertCapability(turn.capability, `${path}.capability`);
  }
  if (turn.analysisInputs !== undefined) {
    const inputs = exactObject(
      turn.analysisInputs,
      `${path}.analysisInputs`,
      ['excerpt', 'context']
    );
    assertAnalysisInputProvenance(inputs.excerpt, `${path}.analysisInputs.excerpt`);
    assertAnalysisInputProvenance(inputs.context, `${path}.analysisInputs.context`);
  }
  if (turn.actionableFindings !== undefined) {
    arrayOf(turn.actionableFindings, `${path}.actionableFindings`, assertFinding);
  }
  if (turn.messageAttachments !== undefined) {
    arrayOf(
      turn.messageAttachments,
      `${path}.messageAttachments`,
      assertMessageAttachmentSnapshot
    );
  }
  if (turn.usage !== undefined) {
    assertTokenUsage(turn.usage, `${path}.usage`);
  }
  if (turn.citations !== undefined) {
    arrayOf(turn.citations, `${path}.citations`, assertCitation);
  }
  optionalBooleanAt(turn.truncated, `${path}.truncated`);
  if (turn.behavior !== undefined) {
    assertBehavior(turn.behavior, `${path}.behavior`);
  }
  if (turn.behaviorTransition !== undefined) {
    assertBehaviorTransition(turn.behaviorTransition, `${path}.behaviorTransition`);
  }
  if (turn.widgetCommit !== undefined) {
    assertTurnWidgetCommit(turn.widgetCommit, `${path}.widgetCommit`);
  }
  if (turn.widgetRecommendation !== undefined) {
    assertTurnWidgetRecommendation(turn.widgetRecommendation, `${path}.widgetRecommendation`);
  }
  if (turn.standingDirectiveChange !== undefined) {
    assertStandingDirectiveChange(
      turn.standingDirectiveChange,
      `${path}.standingDirectiveChange`
    );
  }
}

function assertTurnWidgetCommit(value: unknown, path: string): void {
  const raw = objectAt(value, path);
  if (raw.rail === 'thread-artifact') {
    const commit = exactObject(
      raw,
      path,
      ['widgetId', 'widgetConfigId', 'rail', 'artifactId', 'selectionCount']
    );
    if (!isWorkshopWidgetId(commit.widgetId)) {
      shapeError(`${path}.widgetId`, 'known Conversation Widget id');
    }
    stringAt(commit.widgetConfigId, `${path}.widgetConfigId`);
    stringAt(commit.artifactId, `${path}.artifactId`);
    numberAt(commit.selectionCount, `${path}.selectionCount`);
    return;
  }
  const commit = exactObject(
    raw,
    path,
    ['widgetId', 'widgetConfigId', 'rail', 'directiveId', 'revision']
  );
  enumAt(commit.rail, `${path}.rail`, ['standing']);
  enumAt(commit.widgetId, `${path}.widgetId`, ['lexical-gravity', 'prose-controller']);
  stringAt(commit.widgetConfigId, `${path}.widgetConfigId`);
  stringAt(commit.directiveId, `${path}.directiveId`);
  numberAt(commit.revision, `${path}.revision`);
}

function assertStandingDirectiveChange(value: unknown, path: string): void {
  const change = exactObject(
    value,
    path,
    ['action', 'family', 'widgetId', 'directiveId', 'widgetConfigId', 'revision']
  );
  enumAt(change.action, `${path}.action`, ['installed', 'shifted', 'removed']);
  enumAt(change.family, `${path}.family`, ['lexical-gravity', 'prose-controller']);
  enumAt(change.widgetId, `${path}.widgetId`, ['lexical-gravity', 'prose-controller']);
  stringAt(change.directiveId, `${path}.directiveId`);
  stringAt(change.widgetConfigId, `${path}.widgetConfigId`);
  numberAt(change.revision, `${path}.revision`);
}

function assertTurnWidgetRecommendation(value: unknown, path: string): void {
  const recommendation = exactObject(value, path, ['widgetId'], ['seed']);
  // Persisted recommendations are deliberately catalog-bound, not route-policy-bound:
  // a staged build must not write a session that the shipped codec cannot reopen.
  if (!isLiveWorkshopWidgetId(recommendation.widgetId)) {
    shapeError(`${path}.widgetId`, 'live Conversation Widget id');
  }
  if (recommendation.seed === undefined) return;
  if (recommendation.widgetId === 'gesture-playground') {
    assertGesturePlaygroundRecommendationSeedShape(recommendation.seed, `${path}.seed`);
    return;
  }
  if (recommendation.widgetId === 'lexical-gravity') {
    assertLexicalGravityRecommendationSeedShape(recommendation.seed, `${path}.seed`);
    return;
  }
  shapeError(`${path}.widgetId`, 'a widget with a recommendation codec');
}

function assertCitation(value: unknown, path: string): void {
  const citation = exactObject(value, path, ['url'], ['title', 'startIndex', 'endIndex']);
  stringAt(citation.url, `${path}.url`);
  if (!isHttpUrl(citation.url)) {
    throw new Error(`${path}.url must be a complete HTTP(S) URL`);
  }
  optionalStringAt(citation.title, `${path}.title`);
  optionalNumberAt(citation.startIndex, `${path}.startIndex`);
  optionalNumberAt(citation.endIndex, `${path}.endIndex`);
}

function assertAnalysisInputProvenance(value: unknown, path: string): void {
  const input = exactObject(
    value,
    path,
    ['mode', 'material', 'chosenBy', 'words'],
    ['truncation']
  );
  enumAt(input.mode, `${path}.mode`, ['inherit', 'prepend', 'replace', 'omit']);
  stringAt(input.material, `${path}.material`);
  stringAt(input.chosenBy, `${path}.chosenBy`);
  numberAt(input.words, `${path}.words`);
  optionalStringAt(input.truncation, `${path}.truncation`);
}

function assertCapability(value: unknown, path: string): void {
  // `invokedBy` is optional at the SHAPE layer only: checkpoints written
  // before Sprint 13C lack it, and hydration migration stamps the host
  // principal (the sole possible invoker back then). Current code always
  // writes it.
  const capability = exactObject(
    value,
    path,
    ['operation', 'status', 'requestSummary', 'requestedByPersonaId'],
    ['metadata', 'invokedBy', 'publishedWithTurnId']
  );
  enumAt(
    capability.operation,
    `${path}.operation`,
    [
      'dictionary.lookup',
      'dictionary.full-entry',
      'analysis.run',
      'resource.catalog',
      'resource.search',
      'resource.read'
    ]
  );
  enumAt(
    capability.status,
    `${path}.status`,
    ['success', 'partial', 'failed', 'cancelled', 'rejected']
  );
  stringAt(capability.requestSummary, `${path}.requestSummary`);
  if (!isWorkshopPersonaId(capability.requestedByPersonaId)) {
    shapeError(`${path}.requestedByPersonaId`, 'known Workshop persona id');
  }
  if (capability.invokedBy !== undefined) {
    assertCapabilityPrincipal(capability.invokedBy, `${path}.invokedBy`);
  }
  optionalStringAt(capability.publishedWithTurnId, `${path}.publishedWithTurnId`);
  if (capability.metadata !== undefined) {
    jsonObjectAt(capability.metadata, `${path}.metadata`);
  }
}

function assertCapabilityPrincipal(value: unknown, path: string): void {
  const principal = exactObject(value, path, ['kind'], ['personaId']);
  enumAt(principal.kind, `${path}.kind`, ['host', 'personaGuest']);
  if (principal.kind === 'personaGuest') {
    if (!isWorkshopPersonaId(principal.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
  } else if (principal.personaId !== undefined) {
    shapeError(`${path}.personaId`, 'absent for a host principal');
  }
}

function assertFinding(value: unknown, path: string): void {
  const finding = exactObject(value, path, ['key', 'text', 'ordinal'], ['priority']);
  stringAt(finding.key, `${path}.key`);
  stringAt(finding.text, `${path}.text`);
  numberAt(finding.ordinal, `${path}.ordinal`);
  if (finding.priority !== undefined) {
    enumAt(finding.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
}

function assertMessageAttachmentSnapshot(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words'],
    ['relativePath', 'configuredResource', 'truncation']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertTokenUsage(value: unknown, path: string): void {
  const usage = exactObject(
    value,
    path,
    ['promptTokens', 'completionTokens', 'totalTokens'],
    ['requestCount', 'costUsd', 'isEstimate']
  );
  numberAt(usage.promptTokens, `${path}.promptTokens`);
  numberAt(usage.completionTokens, `${path}.completionTokens`);
  numberAt(usage.totalTokens, `${path}.totalTokens`);
  optionalNumberAt(usage.requestCount, `${path}.requestCount`);
  optionalNumberAt(usage.costUsd, `${path}.costUsd`);
  optionalBooleanAt(usage.isEstimate, `${path}.isEstimate`);
}

function assertBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    [
      'interactionMode',
      'expressionLevel',
      'relationalDepth',
      'carryCuesThroughSession'
    ],
    // Development-checkpoint compatibility: 02B-A added this behavior stamp.
    ['proactiveAssistance']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
  booleanAt(behavior.carryCuesThroughSession, `${path}.carryCuesThroughSession`);
  optionalBooleanAt(behavior.proactiveAssistance, `${path}.proactiveAssistance`);
}

function assertLastCommittedBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    ['interactionMode', 'expressionLevel', 'relationalDepth']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
}

function assertBehaviorTransition(value: unknown, path: string): void {
  const transition = exactObject(value, path, ['from', 'to', 'reason']);
  assertLastCommittedBehavior(transition.from, `${path}.from`);
  assertLastCommittedBehavior(transition.to, `${path}.to`);
  if (transition.reason !== 'writer-selected') {
    shapeError(`${path}.reason`, 'writer-selected');
  }
}

function assertParticipants(value: unknown): void {
  const participants = exactObject(
    value,
    'Workshop session state.participants',
    ['host', 'toolSidecars', 'personaGuests', 'chatTarget']
  );
  const host = exactObject(
    participants.host,
    'Workshop session state.participants.host',
    ['personaId'],
    ['conversationKey', 'lastSeenRoomTurnId']
  );
  if (!isWorkshopPersonaId(host.personaId)) {
    shapeError('Workshop session state.participants.host.personaId', 'known Workshop persona id');
  }
  if (host.conversationKey !== undefined && host.conversationKey !== 'host') {
    shapeError('Workshop session state.participants.host.conversationKey', 'host');
  }
  optionalStringAt(
    host.lastSeenRoomTurnId,
    'Workshop session state.participants.host.lastSeenRoomTurnId'
  );
  arrayOf(
    participants.toolSidecars,
    'Workshop session state.participants.toolSidecars',
    (sidecarValue, sidecarPath) => {
      const sidecar = exactObject(
        sidecarValue,
        sidecarPath,
        ['toolId', 'conversationKey', 'latestReportTurnId'],
        ['deliveredToHostThroughTurnId']
      );
      if (!isWorkshopToolId(sidecar.toolId)) {
        shapeError(`${sidecarPath}.toolId`, 'known Workshop tool id');
      }
      stringAt(sidecar.conversationKey, `${sidecarPath}.conversationKey`);
      stringAt(sidecar.latestReportTurnId, `${sidecarPath}.latestReportTurnId`);
      optionalStringAt(
        sidecar.deliveredToHostThroughTurnId,
        `${sidecarPath}.deliveredToHostThroughTurnId`
      );
    }
  );
  arrayOf(
    participants.personaGuests,
    'Workshop session state.participants.personaGuests',
    (guestValue, guestPath) => {
      const guest = exactObject(
        guestValue,
        guestPath,
        ['personaId', 'liveness'],
        [
          'conversationKey',
          'lastSeenRoomTurnId',
          'lastSeenHostTurnId',
          'deliveredToHostThroughTurnId'
        ]
      );
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      enumAt(guest.liveness, `${guestPath}.liveness`, ['live', 'disposed']);
      optionalStringAt(guest.conversationKey, `${guestPath}.conversationKey`);
      optionalStringAt(guest.lastSeenRoomTurnId, `${guestPath}.lastSeenRoomTurnId`);
      optionalStringAt(guest.lastSeenHostTurnId, `${guestPath}.lastSeenHostTurnId`);
      optionalStringAt(
        guest.deliveredToHostThroughTurnId,
        `${guestPath}.deliveredToHostThroughTurnId`
      );
    }
  );
  assertChatTarget(participants.chatTarget, 'Workshop session state.participants.chatTarget');
}

function assertChatTarget(value: unknown, path: string): void {
  const target = objectAt(value, path);
  if (target.kind === 'host') {
    exactKeys(target, path, ['kind']);
    return;
  }
  if (target.kind === 'tool') {
    exactKeys(target, path, ['kind', 'toolId']);
    if (!isWorkshopToolId(target.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
    return;
  }
  if (target.kind === 'personaGuest') {
    exactKeys(target, path, ['kind', 'personaId']);
    if (!isWorkshopPersonaId(target.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    return;
  }
  shapeError(`${path}.kind`, 'host, tool, or personaGuest');
}

function assertStoredTodo(value: unknown, path: string): void {
  const todo = exactObject(
    value,
    path,
    ['id', 'text', 'status', 'source', 'createdAt'],
    ['priority', 'writerEdit']
  );
  stringAt(todo.id, `${path}.id`);
  stringAt(todo.text, `${path}.text`);
  enumAt(todo.status, `${path}.status`, ['open', 'completed', 'dismissed']);
  if (todo.priority !== undefined) {
    enumAt(todo.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
  assertTodoSource(todo.source, `${path}.source`);
  numberAt(todo.createdAt, `${path}.createdAt`);
  if (todo.writerEdit !== undefined) {
    const writerEdit = exactObject(
      todo.writerEdit,
      `${path}.writerEdit`,
      ['originalText', 'editedAt']
    );
    stringAt(writerEdit.originalText, `${path}.writerEdit.originalText`);
    numberAt(writerEdit.editedAt, `${path}.writerEdit.editedAt`);
  }
}

function assertTodoSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  const baseRequired = [
    'kind',
    'turnId',
    'participantLabel',
    'findingKey',
    'findingText',
    'excerptVersion'
  ];
  if (source.kind === 'tool_report') {
    exactKeys(source, path, [...baseRequired, 'toolId']);
    if (!isWorkshopToolId(source.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
  } else if (source.kind === 'host_turn') {
    exactKeys(source, path, [...baseRequired, 'personaId'], ['upstreamReportTurnId']);
    if (!isWorkshopPersonaId(source.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    optionalStringAt(source.upstreamReportTurnId, `${path}.upstreamReportTurnId`);
  } else if (source.kind === 'guest_turn') {
    exactKeys(source, path, [...baseRequired, 'personaId']);
    if (!isWorkshopPersonaId(source.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
  } else {
    shapeError(`${path}.kind`, 'tool_report, host_turn, or guest_turn');
  }
  stringAt(source.turnId, `${path}.turnId`);
  stringAt(source.participantLabel, `${path}.participantLabel`);
  stringAt(source.findingKey, `${path}.findingKey`);
  stringAt(source.findingText, `${path}.findingText`);
  numberAt(source.excerptVersion, `${path}.excerptVersion`);
}
