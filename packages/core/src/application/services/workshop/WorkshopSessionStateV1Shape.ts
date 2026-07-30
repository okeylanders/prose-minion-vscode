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
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_TODO_BOUNDS
} from '@/application/services/workshop/WorkshopSessionLimits';
import {
  MAXIMUM_PERSISTED_JSON_DEPTH
} from '@/application/services/workshop/persistedJson';
import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export function assertWorkshopSessionStateShape(
  value: unknown
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
    arrayOf(state.widgetConfigs, 'Workshop session state.widgetConfigs', assertWidgetConfig);
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
    ['widgetConfig']
  );
  numberAt(counters.attachment, 'Workshop session state.counters.attachment');
  numberAt(counters.threadArtifact, 'Workshop session state.counters.threadArtifact');
  numberAt(counters.turn, 'Workshop session state.counters.turn');
  numberAt(counters.todo, 'Workshop session state.counters.todo');
  optionalNumberAt(counters.widgetConfig, 'Workshop session state.counters.widgetConfig');
}

function assertWidgetConfig(value: unknown, path: string): void {
  const config = exactObject(
    value,
    path,
    ['id', 'widgetId', 'revision', 'draft', 'createdAt'],
    ['clonedFromConfigId', 'committedTurnId', 'artifactId']
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
  assertGestureDraft(config.draft, `${path}.draft`);
}

function assertGestureDraft(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const draft = exactObject(
    value,
    path,
    [
      'targetPhrase',
      'writerInstructions',
      'contextText',
      'characterNotes',
      'sourceReferences',
      'dictionaryMarkdown',
      'menu',
      'selections',
      'note'
    ],
    ['includeDictionaryInCommit']
  );
  boundedStringAt(
    draft.targetPhrase,
    `${path}.targetPhrase`,
    budget.gestureTargetPhraseCharacters,
    false
  );
  boundedStringAt(
    draft.writerInstructions,
    `${path}.writerInstructions`,
    budget.gestureWriterInstructionsCharacters
  );
  boundedStringAt(
    draft.contextText,
    `${path}.contextText`,
    budget.gestureContextCharacters
  );
  boundedStringAt(
    draft.characterNotes,
    `${path}.characterNotes`,
    budget.gestureCharacterNotesCharacters
  );
  assertWidgetSourceReferences(draft.sourceReferences, `${path}.sourceReferences`);
  boundedStringAt(
    draft.dictionaryMarkdown,
    `${path}.dictionaryMarkdown`,
    budget.gestureDictionaryCharacters,
    false
  );
  if (draft.includeDictionaryInCommit !== undefined) {
    booleanAt(
      draft.includeDictionaryInCommit,
      `${path}.includeDictionaryInCommit`
    );
  }
  if (
    !Array.isArray(draft.selections)
    || draft.selections.length === 0
    || draft.selections.length > budget.gestureSelectionsPerCommit
  ) {
    shapeError(
      `${path}.selections`,
      `an array of 1–${budget.gestureSelectionsPerCommit} strings`
    );
  }
  const selections = draft.selections as unknown[];
  const seenSelections = new Set<string>();
  arrayOf(selections, `${path}.selections`, (selection, selectionPath) => {
    boundedStringAt(selection, selectionPath, budget.gestureOptionCharacters, false);
    const text = selection as string;
    if (seenSelections.has(text)) {
      shapeError(`${path}.selections`, 'an array without duplicate directions');
    }
    seenSelections.add(text);
  });
  boundedStringAt(draft.note, `${path}.note`, budget.gestureNoteCharacters);
  if (
    !Array.isArray(draft.menu)
    || draft.menu.length < budget.gestureMenuGroupsMinimum
    || draft.menu.length > budget.gestureMenuGroups
  ) {
    shapeError(
      `${path}.menu`,
      `an array of ${budget.gestureMenuGroupsMinimum}–${budget.gestureMenuGroups} groups`
    );
  }
  const menuOptions = new Set<string>();
  arrayOf(draft.menu, `${path}.menu`, (groupValue, groupPath) => {
    const group = exactObject(groupValue, groupPath, ['heading', 'options']);
    boundedStringAt(
      group.heading,
      `${groupPath}.heading`,
      budget.gestureOptionCharacters,
      false
    );
    if (
      !Array.isArray(group.options)
      || group.options.length < budget.gestureOptionsPerGroupMinimum
      || group.options.length > budget.gestureOptionsPerGroup
    ) {
      shapeError(
        `${groupPath}.options`,
        `an array of ${budget.gestureOptionsPerGroupMinimum}–${budget.gestureOptionsPerGroup} strings`
      );
    }
    arrayOf(group.options, `${groupPath}.options`, (option, optionPath) => {
      boundedStringAt(option, optionPath, budget.gestureOptionCharacters, false);
      const text = option as string;
      if (menuOptions.has(text)) {
        shapeError(`${path}.menu`, 'groups without duplicate options');
      }
      menuOptions.add(text);
    });
  });
  if ([...seenSelections].some((selection) => !menuOptions.has(selection))) {
    shapeError(`${path}.selections`, 'directions drawn from the generated menu');
  }
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
      'widgetRecommendation'
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
}

function assertTurnWidgetCommit(value: unknown, path: string): void {
  const commit = exactObject(
    value,
    path,
    ['widgetId', 'widgetConfigId', 'rail', 'artifactId', 'selectionCount']
  );
  if (!isWorkshopWidgetId(commit.widgetId)) {
    shapeError(`${path}.widgetId`, 'known Conversation Widget id');
  }
  stringAt(commit.widgetConfigId, `${path}.widgetConfigId`);
  enumAt(commit.rail, `${path}.rail`, ['thread-artifact']);
  stringAt(commit.artifactId, `${path}.artifactId`);
  numberAt(commit.selectionCount, `${path}.selectionCount`);
}

function assertTurnWidgetRecommendation(value: unknown, path: string): void {
  const recommendation = exactObject(value, path, ['widgetId'], ['seed']);
  if (!isLiveWorkshopWidgetId(recommendation.widgetId)) {
    shapeError(`${path}.widgetId`, 'live Conversation Widget id');
  }
  if (recommendation.seed !== undefined) {
    const budget = PROMPT_BUDGETS.workshopWidgets;
    const seed = exactObject(
      recommendation.seed,
      `${path}.seed`,
      [],
      [
        'targetPhrase',
        'writerInstructions',
        'contextText',
        'characterNotes',
        'sourceReferences'
      ]
    );
    optionalBoundedStringAt(
      seed.targetPhrase,
      `${path}.seed.targetPhrase`,
      budget.gestureTargetPhraseCharacters,
      false
    );
    optionalBoundedStringAt(
      seed.writerInstructions,
      `${path}.seed.writerInstructions`,
      budget.gestureWriterInstructionsCharacters,
      false
    );
    optionalBoundedStringAt(
      seed.contextText,
      `${path}.seed.contextText`,
      budget.gestureContextCharacters,
      false
    );
    optionalBoundedStringAt(
      seed.characterNotes,
      `${path}.seed.characterNotes`,
      budget.gestureCharacterNotesCharacters,
      false
    );
    if (seed.sourceReferences !== undefined) {
      assertWidgetSourceReferences(seed.sourceReferences, `${path}.seed.sourceReferences`);
    }
  }
}

function assertWidgetSourceReferences(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (!Array.isArray(value) || value.length > budget.gestureSourceReferences) {
    shapeError(path, `an array of at most ${budget.gestureSourceReferences} source references`);
  }
  const seen = new Set<string>();
  let serializedCharacters = 0;
  arrayOf(value, path, (referenceValue, referencePath) => {
    const reference = objectAt(referenceValue, referencePath);
    if (reference.kind === 'active-excerpt') {
      exactKeys(reference, referencePath, ['kind']);
    } else if (reference.kind === 'context-attachment') {
      exactKeys(reference, referencePath, ['kind', 'attachmentId']);
      stringAt(reference.attachmentId, `${referencePath}.attachmentId`);
      if (!/^ctx-[1-9]\d*$/.test(reference.attachmentId as string)) {
        shapeError(`${referencePath}.attachmentId`, 'a ctx-<n> attachment id');
      }
    } else {
      shapeError(`${referencePath}.kind`, 'active-excerpt or context-attachment');
    }
    const key = reference.kind === 'active-excerpt'
      ? 'active-excerpt'
      : `context-attachment:${String(reference.attachmentId)}`;
    serializedCharacters += key.length + (seen.size > 0 ? 1 : 0);
    if (serializedCharacters > budget.gestureSourceReferenceCharacters) {
      shapeError(
        path,
        `source references within ${budget.gestureSourceReferenceCharacters} characters`
      );
    }
    if (seen.has(key)) {
      shapeError(path, 'source references without duplicates');
    }
    seen.add(key);
  });
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
    ['interactionMode', 'expressionLevel', 'relationalDepth', 'carryCuesThroughSession']
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

function exactObject(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  const object = objectAt(value, path);
  exactKeys(object, path, required, optional);
  return object;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    shapeError(path, 'plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  object: Record<string, unknown>,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(object).find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`${path} contains unknown field ${unknown}`);
  }
  const missing = required.find(
    (key) => !Object.prototype.hasOwnProperty.call(object, key) || object[key] === undefined
  );
  if (missing) {
    throw new Error(`${path} is missing required field ${missing}`);
  }
}

function arrayOf(
  value: unknown,
  path: string,
  assertItem: (item: unknown, itemPath: string) => void
): void {
  if (!Array.isArray(value)) {
    shapeError(path, 'array');
  }
  value.forEach((item, index) => assertItem(item, `${path}[${index}]`));
}

function stringAt(value: unknown, path: string): void {
  if (typeof value !== 'string') {
    shapeError(path, 'string');
  }
}

function boundedStringAt(
  value: unknown,
  path: string,
  maximumCharacters: number,
  allowBlank = true
): void {
  stringAt(value, path);
  const text = value as string;
  if (!allowBlank && text.trim().length === 0) {
    shapeError(path, 'a non-empty string');
  }
  if (text.length > maximumCharacters) {
    shapeError(path, `a string of at most ${maximumCharacters} characters`);
  }
}

function optionalStringAt(value: unknown, path: string): void {
  if (value !== undefined) {
    stringAt(value, path);
  }
}

function optionalBoundedStringAt(
  value: unknown,
  path: string,
  maximumCharacters: number,
  allowBlank = true
): void {
  if (value !== undefined) {
    boundedStringAt(value, path, maximumCharacters, allowBlank);
  }
}

function numberAt(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    shapeError(path, 'finite number');
  }
}

function optionalNumberAt(value: unknown, path: string): void {
  if (value !== undefined) {
    numberAt(value, path);
  }
}

function booleanAt(value: unknown, path: string): void {
  if (typeof value !== 'boolean') {
    shapeError(path, 'boolean');
  }
}

function optionalBooleanAt(value: unknown, path: string): void {
  if (value !== undefined) {
    booleanAt(value, path);
  }
}

function enumAt(value: unknown, path: string, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    shapeError(path, allowed.join(' | '));
  }
}

function jsonObjectAt(value: unknown, path: string): void {
  objectAt(value, path);
  assertJsonValue(value, path);
}

/**
 * Free-form JSON validation for capability metadata.
 *
 * This runs on BOTH sides of the durable boundary: on read against a
 * `JSON.parse` result (where `undefined` cannot occur) and on write against the
 * live in-memory object (where it routinely does — any optional metadata field
 * the persona omitted is an `undefined` member).
 *
 * So it must honor the same policy `clonePersistedJson` documents: an
 * `undefined` OBJECT MEMBER is an absent member, exactly as `JSON.stringify`
 * omits it. Rejecting one used to fail every save of a session containing a
 * `resource.read` without an explicit `endLine` — the validator refusing a value
 * that would never have reached disk.
 *
 * An `undefined` ARRAY ITEM is a different matter and stays refused: JSON has no
 * hole, so `JSON.stringify` writes `null` there, silently changing the data.
 */
function assertJsonValue(value: unknown, path: string, depth = 0): void {
  if (depth > MAXIMUM_PERSISTED_JSON_DEPTH) {
    throw new Error(
      `${path} exceeds the maximum JSON nesting depth of ${MAXIMUM_PERSISTED_JSON_DEPTH}.`
    );
  }
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    numberAt(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, depth + 1)
    );
    return;
  }
  if (value === undefined) {
    // Only reachable as an array item: object members are skipped below.
    shapeError(path, 'a JSON value (an undefined array item would be written as null)');
  }
  const object = objectAt(value, path);
  for (const [key, nested] of Object.entries(object)) {
    if (nested === undefined) {
      continue;
    }
    assertJsonValue(nested, `${path}.${key}`, depth + 1);
  }
}

function shapeError(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}`);
}
