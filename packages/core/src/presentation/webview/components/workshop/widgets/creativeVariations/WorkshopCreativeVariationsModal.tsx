/**
 * WorkshopCreativeVariationsModal — the Creative Variations Explorer's
 * pre-commit surface (Sprint 03; design Spread 07; ADR 2026-07-22 family).
 *
 * A comparison studio, not a rewrite button: the writer declares what must
 * survive and what must not change, aims one custom intent at a verbalized
 * sampling distance, generates one bounded workup, compares takes, and
 * commits only chosen directions (or explicitly promoted prose) to one room
 * turn. Nothing here writes to the editor.
 *
 * CONTROLLED presentation. Unlike the Gesture modal, the durable authoring
 * truth lives in the feature's authoring controller: this component renders
 * the draft it is given and raises semantic callbacks. It owns only
 * presentation chrome the persisted contract explicitly excludes — the
 * comparison tray's open state and compare marks, and the overlap-matrix
 * disclosure. Request correlation, invalidation, commit eligibility, and
 * budgets are controller/host rules projected in via props.
 *
 * Overlap copy discipline: the readout is deterministic TEXTUAL OVERLAP —
 * surface reuse evidence. It is never named similarity, quality, or ranking,
 * and a high score warns without hiding, ranking, or removing a take.
 */

import * as React from 'react';
import {
  WorkshopCreativeVariationsCarryMode,
  WorkshopCreativeVariationsDistance,
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsRequestedCount,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import { CreativeVariationCard } from './CreativeVariationCard';
import { CreativeVariationsComparison } from './CreativeVariationsComparison';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

/** Display posture of the current opening; mapped from the opening controller. */
export type WorkshopCreativeVariationsBanner =
  | { kind: 'none' }
  | { kind: 'seed'; personaLabel: string }
  | { kind: 'clone' };

/** Presentation projection of the async generation lifecycle. */
export type WorkshopCreativeVariationsGenerationPhase =
  | { kind: 'idle' }
  | { kind: 'generating'; detail?: string }
  | { kind: 'failed'; message: string };

/**
 * Controller-computed commit blockers, most important first. The modal maps
 * each to writer-facing copy; it never re-derives the rules.
 */
export type WorkshopCreativeVariationsCommitBlocker =
  | 'generation-in-flight'
  | 'commit-in-flight'
  | 'room-run-active'
  | 'no-workup'
  | 'no-selection'
  | 'unaccepted-advisory-risk'
  | 'over-artifact-budget';

export interface WorkshopCreativeVariationsAvailableSource {
  reference: WorkshopWidgetSourceReference;
  label: string;
  detail: string;
}

export interface WorkshopCreativeVariationsArtifactUsage {
  characters: number;
  budget: number;
}

export interface WorkshopCreativeVariationsModalProps {
  open: boolean;
  banner: WorkshopCreativeVariationsBanner;
  draft: WorkshopCreativeVariationsDraft;
  generation: WorkshopCreativeVariationsGenerationPhase;
  commitPending: boolean;
  commitError: string | null;
  commitBlockers: readonly WorkshopCreativeVariationsCommitBlocker[];
  /** Host/controller-computed commit-payload projection; null before any selection. */
  artifactUsage: WorkshopCreativeVariationsArtifactUsage | null;
  /** Slice 3 calibration constant; a maximum pair at/over this warns. */
  highOverlapThreshold: number;
  availableSources: readonly WorkshopCreativeVariationsAvailableSource[];
  onUseSelection: () => void;
  onSubjectTextChange: (text: string) => void;
  onSurroundingContextChange: (text: string) => void;
  onToggleSourceReference: (reference: WorkshopWidgetSourceReference) => void;
  onMustSurviveChange: (text: string) => void;
  onMustNotChangeChange: (text: string) => void;
  onAimChange: (text: string) => void;
  onDistanceChange: (distance: WorkshopCreativeVariationsDistance) => void;
  onRequestedCountChange: (count: WorkshopCreativeVariationsRequestedCount) => void;
  onGenerate: () => void;
  onCancelGenerate: () => void;
  onToggleCardSelection: (position: number) => void;
  onCarryModeChange: (position: number, mode: WorkshopCreativeVariationsCarryMode) => void;
  onToggleAdvisoryRisk: (position: number, riskId: string) => void;
  onNoteChange: (note: string) => void;
  onCopyVariation: (position: number) => void;
  onCommit: () => void;
  widgetModelOptions: ModelOption[];
  selectedWidgetModel: string;
  onWidgetModelChange: (modelId: string) => void;
  onOpenWidgetModelBrowser: () => void;
  onClose: () => void;
}

const DISTANCES: Array<{
  value: WorkshopCreativeVariationsDistance;
  label: string;
  band: string;
  line: string;
}> = [
  {
    value: 'familiar',
    label: 'Familiar',
    band: 'p ≈ 0.6',
    line: 'The moves most editors reach for first — a baseline the rest of the workup must beat.'
  },
  {
    value: 'adjacent',
    label: 'Adjacent',
    band: 'p ≈ 0.3',
    line: 'Competent alternatives from a different angle.'
  },
  {
    value: 'tail',
    label: 'Tail',
    band: 'p < 0.10',
    line: 'The less-common tenth — the default, and the reason this widget exists.'
  },
  {
    value: 'far-tail',
    label: 'Far tail',
    band: 'p < 0.02',
    line: 'Deliberately unlikely. Expect one unusable take — it usually names the thing the passage is avoiding.'
  }
];

const COUNTS: WorkshopCreativeVariationsRequestedCount[] = [3, 4, 5];

const COMMIT_BLOCKER_COPY: Record<WorkshopCreativeVariationsCommitBlocker, string> = {
  'generation-in-flight': 'Generation is still running.',
  'commit-in-flight': 'Committing…',
  'room-run-active': 'The room is mid-turn — commit when the current run settles.',
  'no-workup': 'Generate a workup before committing.',
  'no-selection': 'Select at least one take to commit.',
  'unaccepted-advisory-risk':
    'Accept every advisory risk on your selected takes, or unselect those takes.',
  'over-artifact-budget':
    'The commit payload is over its ceiling — carry more takes as direction, or trim the note.'
};

const sourceReferenceKey = (reference: WorkshopWidgetSourceReference): string =>
  reference.kind === 'active-excerpt'
    ? reference.kind
    : `${reference.kind}:${reference.attachmentId}`;

export const WorkshopCreativeVariationsModal: React.FC<WorkshopCreativeVariationsModalProps> = ({
  open,
  banner,
  draft,
  generation,
  commitPending,
  commitError,
  commitBlockers,
  artifactUsage,
  highOverlapThreshold,
  availableSources,
  onUseSelection,
  onSubjectTextChange,
  onSurroundingContextChange,
  onToggleSourceReference,
  onMustSurviveChange,
  onMustNotChangeChange,
  onAimChange,
  onDistanceChange,
  onRequestedCountChange,
  onGenerate,
  onCancelGenerate,
  onToggleCardSelection,
  onCarryModeChange,
  onToggleAdvisoryRisk,
  onNoteChange,
  onCopyVariation,
  onCommit,
  widgetModelOptions,
  selectedWidgetModel,
  onWidgetModelChange,
  onOpenWidgetModelBrowser,
  onClose
}) => {
  /* Ephemeral chrome the persisted contract excludes on purpose: compare
     marks and the open comparison tray reset with the workup identity. */
  const [comparedPositions, setComparedPositions] = React.useState<number[]>([]);
  const [comparisonOpen, setComparisonOpen] = React.useState(false);
  const [modelBrowserOpen, setModelBrowserOpen] = React.useState(false);

  const workupId = draft.workup?.workupId ?? null;
  React.useEffect(() => {
    setComparedPositions([]);
    setComparisonOpen(false);
  }, [workupId, open]);

  const generating = generation.kind === 'generating';
  const interactionLocked = generating || commitPending;

  const pasted = draft.subject.provenance.kind === 'pasted';
  const provenance = draft.subject.provenance;
  const surroundingContextTravels =
    draft.surroundingContext.writerText.trim().length > 0
    || draft.surroundingContext.sourceReferences.length > 0;

  const generateReasons: string[] = [];
  if (draft.subject.text.trim().length === 0) {
    generateReasons.push('Add the passage to vary.');
  }
  if (draft.invariants.mustSurvive.trim().length === 0) {
    generateReasons.push('“Must survive” is required — name what every take must deliver.');
  }
  if (draft.intent.aim.trim().length === 0) {
    generateReasons.push('The creative aim is required — say what you are asking the takes to do.');
  }
  const generateDisabled = interactionLocked || generateReasons.length > 0;

  const selectionByPosition = React.useMemo(() => {
    const map = new Map<number, { carryMode: WorkshopCreativeVariationsCarryMode; acceptedAdvisoryRiskIds: string[] }>();
    draft.selections.forEach((selection) => {
      map.set(selection.position, {
        carryMode: selection.carryMode,
        acceptedAdvisoryRiskIds: selection.acceptedAdvisoryRiskIds
      });
    });
    return map;
  }, [draft.selections]);

  const workup = draft.workup;
  const comparedCards = React.useMemo(
    () =>
      workup
        ? workup.cards.filter((card) => comparedPositions.includes(card.position))
        : [],
    [workup, comparedPositions]
  );

  const toggleCompare = React.useCallback((position: number) => {
    setComparedPositions((current) =>
      current.includes(position)
        ? current.filter((candidate) => candidate !== position)
        : [...current, position].sort((left, right) => left - right)
    );
  }, []);

  const maximumPair = workup?.overlap.maximumPair ?? null;
  const highOverlap = maximumPair !== null && maximumPair.score >= highOverlapThreshold;

  const selectedCount = draft.selections.length;
  const directionCount = draft.selections.filter(
    (selection) => selection.carryMode === 'direction'
  ).length;
  const proseCount = selectedCount - directionCount;

  const activeBlocker = commitBlockers.length > 0 ? commitBlockers[0] : null;
  const commitDisabled = activeBlocker !== null;

  const close = React.useCallback(() => {
    /* The model browser overlays this sheet and owns the first Escape. */
    if (modelBrowserOpen || commitPending) {
      return;
    }
    if (generating) {
      onCancelGenerate();
    }
    onClose();
  }, [modelBrowserOpen, commitPending, generating, onCancelGenerate, onClose]);

  const changeWidgetModel = React.useCallback(
    (_scope: ModelScope, modelId: string) => {
      if (modelId !== selectedWidgetModel) {
        onWidgetModelChange(modelId);
      }
    },
    [selectedWidgetModel, onWidgetModelChange]
  );

  const availableSourceKeys = React.useMemo(
    () => new Set(availableSources.map(({ reference }) => sourceReferenceKey(reference))),
    [availableSources]
  );
  const unavailableSelectedSources = draft.surroundingContext.sourceReferences.filter(
    (reference) => !availableSourceKeys.has(sourceReferenceKey(reference))
  );

  const generationProgressPanel = (
    <div className="pm-ws-cvx-progress">
      <div className="pm-ws-cvx-progress-copy" role="status" aria-live="polite">
        <span>
          {generation.kind === 'generating' && generation.detail
            ? generation.detail
            : 'Generating the workup'}
          …
        </span>
        <strong>one model call · closed schema · {draft.requestedCount} takes</strong>
      </div>
      <div className="pm-ws-cvx-progress-track" aria-hidden="true">
        <span />
      </div>
      <button type="button" onClick={onCancelGenerate}>
        Cancel generation
      </button>
    </div>
  );

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-cvx-title"
      closeLabel="Close Creative Variations"
      className="pm-ws-cvx-modal"
      onClose={close}
    >
      <div className="pm-ws-cvx">
        <header className="pm-ws-cvx-head">
          <div className="pm-ws-eyebrow pm-ws-cvx-eyebrow">
            Widget{' '}
            <span className="pm-ws-sb-railtag pm-ws-sb-railtag-oneshot">
              one-shot · thread-artifact
            </span>
          </div>
          <h2 id="pm-ws-cvx-title">
            <Icon name="branch" size={17} /> Creative Variations Explorer
          </h2>
          <p className="pm-ws-cvx-sub">
            Several genuinely different takes on the same passage, under constraints{' '}
            <b>you</b> declare. A <b>comparison studio, not a rewrite button</b> — the
            generation cloud is thrown away; only the takes you choose ride to the room.
          </p>

          {banner.kind === 'seed' && (
            <div className="pm-ws-cvx-banner pm-ws-cvx-banner-seed">
              <Icon name="sparkle" size={13} />
              <span>
                <b>Recommended and prefilled by {banner.personaLabel}.</b> Everything here
                is editable — they set the table; generating, selecting, and committing
                stay yours.
              </span>
            </div>
          )}
          {banner.kind === 'clone' && (
            <div className="pm-ws-cvx-banner pm-ws-cvx-banner-clone">
              <Icon name="refresh" size={13} />
              <span>
                <b>Re-opened from a committed turn.</b> The old chip stays as history —
                committing again creates a <b>new</b> turn at the head.
              </span>
            </div>
          )}
          <WorkshopModalShell.CloseButton />
        </header>

        <div className="pm-ws-cvx-body">
          <div className="pm-ws-cvx-grid">
            <div className="pm-ws-cvx-grid-main">
              <div className="pm-ws-cvx-field">
                <span className="pm-ws-cvx-flabel" id="pm-ws-cvx-subject-label">
                  {pasted ? 'Pasted passage' : 'Selected passage'}
                  {pasted ? (
                    <em className="pm-ws-cvx-src pm-ws-cvx-src-pasted">
                      {surroundingContextTravels
                        ? 'pasted · context supplied separately'
                        : 'pasted · no surrounding passage'}
                    </em>
                  ) : (
                    <em className="pm-ws-cvx-src">
                      from excerpt · {provenance.kind === 'excerpt' ? provenance.relativePath : ''}
                      {provenance.kind === 'excerpt' && provenance.startLine !== undefined
                        ? ` · L${provenance.startLine}–${provenance.endLine}`
                        : ''}
                    </em>
                  )}
                  <button
                    type="button"
                    className="pm-ws-cvx-use-selection"
                    disabled={interactionLocked}
                    onClick={onUseSelection}
                  >
                    Use editor selection
                  </button>
                </span>
                <textarea
                  className="pm-ws-cvx-passage"
                  aria-labelledby="pm-ws-cvx-subject-label"
                  value={draft.subject.text}
                  maxLength={BUDGET.creativeSubjectCharacters}
                  disabled={interactionLocked}
                  rows={5}
                  placeholder="Select text in the editor, or paste the passage to vary."
                  onChange={(event) => onSubjectTextChange(event.target.value)}
                />
                <p className="pm-ws-cvx-honest">
                  {surroundingContextTravels
                    ? 'The generation sees this passage, your declared constraints, and the surrounding context or source material selected on this sheet. It cannot check continuity beyond what you supplied.'
                    : pasted
                      ? 'The generation sees this text and your declared constraints and nothing else — it cannot check continuity against the pages around it, and it will not claim to.'
                      : 'This passage came from your excerpt, so its origin travels with the draft. Editing the text here keeps your words; the generation still sees only what is on this sheet.'}
                </p>
              </div>

              <label className="pm-ws-cvx-field">
                <span className="pm-ws-cvx-flabel">
                  Surrounding context <i>optional</i>
                </span>
                <textarea
                  value={draft.surroundingContext.writerText}
                  maxLength={BUDGET.creativeContextCharacters}
                  disabled={interactionLocked}
                  rows={3}
                  placeholder="What comes before and after — anything continuity must honor."
                  onChange={(event) => onSurroundingContextChange(event.target.value)}
                />
              </label>

              <fieldset className="pm-ws-cvx-sources">
                <legend className="pm-ws-cvx-flabel">
                  Source material <i>optional</i>
                </legend>
                <div className="pm-ws-cvx-source-list">
                  {availableSources.map(({ reference, label, detail }) => {
                    const key = sourceReferenceKey(reference);
                    const selected = draft.surroundingContext.sourceReferences.some(
                      (candidate) => sourceReferenceKey(candidate) === key
                    );
                    const atLimit =
                      draft.surroundingContext.sourceReferences.length
                        >= BUDGET.creativeSourceReferences;
                    return (
                      <label className="pm-ws-cvx-source" key={key}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={interactionLocked || (!selected && atLimit)}
                          onChange={() => onToggleSourceReference(reference)}
                        />
                        <span>
                          <b>{label}</b>
                          <small>{detail}</small>
                        </span>
                      </label>
                    );
                  })}
                  {unavailableSelectedSources.map((reference) => (
                    <label
                      className="pm-ws-cvx-source pm-ws-cvx-source-unavailable"
                      key={sourceReferenceKey(reference)}
                    >
                      <input
                        type="checkbox"
                        checked
                        disabled={interactionLocked}
                        onChange={() => onToggleSourceReference(reference)}
                      />
                      <span>
                        <b>
                          {reference.kind === 'active-excerpt'
                            ? 'Active excerpt — unavailable'
                            : `Context attachment ${reference.attachmentId} — unavailable`}
                        </b>
                        <small>Remove this reference before generating again.</small>
                      </span>
                    </label>
                  ))}
                  {availableSources.length === 0
                    && unavailableSelectedSources.length === 0 && (
                    <span className="pm-ws-cvx-source-empty">
                      No active excerpt or standing context is available in this room.
                    </span>
                  )}
                </div>
              </fieldset>
            </div>

            <div className="pm-ws-cvx-grid-side">
              <label className="pm-ws-cvx-field">
                <span className="pm-ws-cvx-flabel">
                  Must survive every take <i>required</i>
                </span>
                <textarea
                  value={draft.invariants.mustSurvive}
                  maxLength={BUDGET.creativeMustSurviveCharacters}
                  disabled={interactionLocked}
                  rows={4}
                  placeholder="The facts, character state, or effect every take must still deliver."
                  onChange={(event) => onMustSurviveChange(event.target.value)}
                />
              </label>
              <label className="pm-ws-cvx-field">
                <span className="pm-ws-cvx-flabel">
                  Must <i className="pm-ws-cvx-flabel-not">not</i> change <i>optional</i>
                </span>
                <textarea
                  value={draft.invariants.mustNotChange}
                  maxLength={BUDGET.creativeMustNotChangeCharacters}
                  disabled={interactionLocked}
                  rows={4}
                  placeholder="Hard boundaries — POV, tense, plot outcome, an exact line."
                  onChange={(event) => onMustNotChangeChange(event.target.value)}
                />
              </label>
            </div>
          </div>

          <label className="pm-ws-cvx-field">
            <span className="pm-ws-cvx-flabel">
              Creative aim <i>required</i>
            </span>
            <textarea
              value={draft.intent.aim}
              maxLength={BUDGET.creativeAimCharacters}
              disabled={interactionLocked}
              rows={2}
              placeholder="e.g. let the room carry the grief — objects and staging instead of stated feeling"
              onChange={(event) => onAimChange(event.target.value)}
            />
          </label>

          <fieldset className="pm-ws-cvx-distance">
            <legend className="pm-ws-cvx-flabel">Sampling distance</legend>
            <div className="pm-ws-cvx-ends" aria-hidden="true">
              <span>the expected choice</span>
              <span>the tenth nobody reaches for</span>
            </div>
            <div className="pm-ws-cvx-steps">
              {DISTANCES.map(({ value, label, band }) => (
                <button
                  key={value}
                  type="button"
                  className={`pm-ws-cvx-step${draft.intent.distance === value ? ' pm-ws-cvx-step-on' : ''}`}
                  aria-pressed={draft.intent.distance === value}
                  disabled={interactionLocked}
                  onClick={() => onDistanceChange(value)}
                >
                  <span className="pm-ws-cvx-step-n">
                    {label}
                    {value === 'tail' && <em> · default</em>}
                  </span>
                  <span className="pm-ws-cvx-step-s">{band}</span>
                </button>
              ))}
            </div>
            <p className="pm-ws-cvx-distance-line">
              {DISTANCES.find(({ value }) => value === draft.intent.distance)?.line}
            </p>
            <p className="pm-ws-cvx-distance-mech">
              The distance is <b>verbalized</b> — instruction language in the prompt, not a
              temperature value. The claim is checked after the fact by the textual-overlap
              readout under the workup.
            </p>
          </fieldset>

          <fieldset className="pm-ws-cvx-count">
            <legend className="pm-ws-cvx-flabel">How many takes</legend>
            <div className="pm-ws-cvx-count-row">
              {COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={draft.requestedCount === count}
                  className={draft.requestedCount === count ? 'pm-ws-cvx-count-on' : undefined}
                  disabled={interactionLocked}
                  onClick={() => onRequestedCountChange(count)}
                >
                  {count}
                </button>
              ))}
              <span className="pm-ws-cvx-count-cap">
                bounded three to five — a cloud is not a comparison
              </span>
            </div>
          </fieldset>

          {generating ? (
            generationProgressPanel
          ) : (
            <>
              <button
                type="button"
                className={`pm-ws-cvx-gen${workup ? ' pm-ws-cvx-gen-ghost' : ''}`}
                disabled={generateDisabled}
                aria-describedby={generateReasons.length > 0 ? 'pm-ws-cvx-gen-reasons' : undefined}
                onClick={onGenerate}
              >
                <Icon name={workup ? 'refresh' : 'sparkle'} size={13} />{' '}
                {workup ? 'Regenerate the workup' : 'Generate the workup'}
              </button>
              {workup && (
                <p className="pm-ws-cvx-regen-note">
                  Regenerating replaces every take and clears selections, carry modes, and
                  accepted risks.
                </p>
              )}
              {generateReasons.length > 0 && (
                <p className="pm-ws-cvx-gen-reasons" id="pm-ws-cvx-gen-reasons">
                  {generateReasons.join(' ')}
                </p>
              )}
            </>
          )}

          {generation.kind === 'failed' && (
            <div className="pm-ws-cvx-error" role="alert">
              {generation.message}
            </div>
          )}
          {commitError && (
            <div className="pm-ws-cvx-error" role="alert">
              {commitError}
            </div>
          )}

          {!workup && !generating && (
            <div className="pm-ws-cvx-seam">
              everything above is deterministic scaffold · one model call, one closed schema ·
              commit never re-runs it
            </div>
          )}

          {workup && (
            <section className="pm-ws-cvx-workup" aria-label="Generated workup">
              <div className="pm-ws-cvx-mgh">
                <span>
                  Sampled at{' '}
                  {DISTANCES.find(({ value }) => value === draft.intent.distance)?.label}
                </span>
                <hr />
                <span className="pm-ws-cvx-mgh-right">
                  {workup.cards.length} returned · none ranked
                </span>
              </div>

              {maximumPair && (
                <div className="pm-ws-cvx-overlap" aria-label="Textual overlap">
                  <span className="pm-ws-cvx-overlap-cap">textual overlap</span>
                  <span className="pm-ws-cvx-overlap-max">
                    maximum pair: Take {maximumPair.leftPosition} ↔ Take{' '}
                    {maximumPair.rightPosition} · {maximumPair.score}%
                  </span>
                  <span className="pm-ws-cvx-overlap-det">
                    deterministic surface reuse · not a meaning or quality score
                  </span>
                </div>
              )}
              {highOverlap && maximumPair && (
                <div className="pm-ws-cvx-overlap-warn" role="status">
                  <Icon name="alert" size={13} />
                  <span>
                    <b>
                      High textual overlap between Take {maximumPair.leftPosition} and Take{' '}
                      {maximumPair.rightPosition} ({maximumPair.score}%).
                    </b>{' '}
                    Two takes share much of their surface phrasing. Nothing is ranked,
                    hidden, or removed — judge them side by side.
                  </span>
                </div>
              )}
              {workup.overlap.pairs.length > 0 && (
                <details className="pm-ws-cvx-overlap-pairs">
                  <summary>All pairs</summary>
                  <table>
                    <caption className="pm-ws-cvx-visually-hidden">
                      Pairwise textual overlap, percent of shared surface phrasing
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Pair</th>
                        <th scope="col">Prose</th>
                        <th scope="col">Direction</th>
                        <th scope="col">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workup.overlap.pairs.map((pair) => (
                        <tr key={`${pair.leftPosition}-${pair.rightPosition}`}>
                          <th scope="row">
                            Take {pair.leftPosition} ↔ Take {pair.rightPosition}
                          </th>
                          <td>{pair.prose}%</td>
                          <td>{pair.direction}%</td>
                          <td>{pair.maximum}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}

              <div className="pm-ws-cvx-cards">
                {workup.cards.map((card) => {
                  const selection = selectionByPosition.get(card.position);
                  return (
                    <CreativeVariationCard
                      key={card.position}
                      card={card}
                      selected={selection !== undefined}
                      carryMode={selection?.carryMode ?? 'direction'}
                      acceptedAdvisoryRiskIds={selection?.acceptedAdvisoryRiskIds ?? []}
                      comparing={comparedPositions.includes(card.position)}
                      interactionLocked={interactionLocked}
                      onToggleSelection={onToggleCardSelection}
                      onCarryModeChange={onCarryModeChange}
                      onToggleAdvisoryRisk={onToggleAdvisoryRisk}
                      onToggleCompare={toggleCompare}
                      onCopyProse={onCopyVariation}
                    />
                  );
                })}
              </div>

              <div className="pm-ws-cvx-cmpbar">
                <button
                  type="button"
                  disabled={comparedPositions.length < 2}
                  aria-expanded={comparisonOpen}
                  onClick={() => setComparisonOpen((current) => !current)}
                >
                  <Icon name="scale" size={13} /> Compare side by side
                </button>
                <span className="pm-ws-cvx-cmpbar-hint">
                  {comparedPositions.length < 2
                    ? 'mark two or more takes to compare — comparison is the product'
                    : 'the declared constraints stay pinned above the columns'}
                </span>
              </div>
              {comparisonOpen && comparedCards.length >= 2 && (
                <CreativeVariationsComparison
                  cards={comparedCards}
                  invariants={draft.invariants}
                  selectedPositions={draft.selections.map((selection) => selection.position)}
                  onDismiss={() => setComparisonOpen(false)}
                />
              )}

              <label className="pm-ws-cvx-field">
                <span className="pm-ws-cvx-flabel">
                  Note to the room <i>optional</i>
                </span>
                <input
                  type="text"
                  value={draft.note}
                  maxLength={BUDGET.creativeNoteCharacters}
                  placeholder="e.g. the props version, but keep her line where it is"
                  onChange={(event) => onNoteChange(event.target.value)}
                />
              </label>

              <div className="pm-ws-cvx-payload">
                <div className="pm-ws-cvx-payload-cap">
                  <span>What commits</span>
                  {artifactUsage && (
                    <span
                      className={`pm-ws-cvx-payload-ceil${
                        artifactUsage.characters > artifactUsage.budget
                          ? ' pm-ws-cvx-payload-over'
                          : ''
                      }`}
                    >
                      {artifactUsage.characters.toLocaleString()} /{' '}
                      {artifactUsage.budget.toLocaleString()} chars
                    </span>
                  )}
                </div>
                {selectedCount === 0 ? (
                  <p className="pm-ws-cvx-payload-none">
                    nothing selected yet — commit stays off, and the whole generation cloud
                    is thrown away
                  </p>
                ) : (
                  <p className="pm-ws-cvx-payload-sum">
                    {selectedCount} take{selectedCount === 1 ? '' : 's'}
                    {directionCount > 0 ? ` · ${directionCount} as direction` : ''}
                    {proseCount > 0 ? ` · ${proseCount} as full prose` : ''}
                    {' '}· both declared constraint fields ride with them
                  </p>
                )}
                {artifactUsage && (
                  <div
                    className={`pm-ws-cvx-meter${
                      artifactUsage.characters > artifactUsage.budget
                        ? ' pm-ws-cvx-meter-over'
                        : ''
                    }`}
                    role="progressbar"
                    aria-label="Commit payload budget"
                    aria-valuemin={0}
                    aria-valuemax={artifactUsage.budget}
                    aria-valuenow={Math.min(artifactUsage.characters, artifactUsage.budget)}
                  >
                    <span
                      /* Dynamic data-driven fill; the stylesheet owns the look. */
                      style={{
                        '--pm-ws-cvx-meter-fill': `${Math.min(
                          100,
                          (artifactUsage.characters / artifactUsage.budget) * 100
                        )}%`
                      } as React.CSSProperties}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="pm-ws-cvx-foot">
          <div className="pm-ws-cvx-model">
            <ModelSelector
              scope="widget"
              options={widgetModelOptions}
              value={selectedWidgetModel}
              onChange={changeWidgetModel}
              onOpenBrowser={onOpenWidgetModelBrowser}
              onBrowserOpenChange={setModelBrowserOpen}
              label="Widget Model"
              disabled={interactionLocked}
            />
            {workup && (
              <span className="pm-ws-cvx-foot-count">· {selectedCount} selected</span>
            )}
          </div>
          {activeBlocker && activeBlocker !== 'commit-in-flight' && (
            <span className="pm-ws-cvx-commit-reason" id="pm-ws-cvx-commit-reason">
              {COMMIT_BLOCKER_COPY[activeBlocker]}
            </span>
          )}
          <button
            type="button"
            className="pm-ws-cvx-cancel"
            disabled={commitPending}
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pm-ws-cvx-commit"
            disabled={commitDisabled}
            aria-describedby={
              activeBlocker && activeBlocker !== 'commit-in-flight'
                ? 'pm-ws-cvx-commit-reason'
                : undefined
            }
            onClick={onCommit}
          >
            {commitPending
              ? 'Committing…'
              : banner.kind === 'clone' ? 'Commit as new turn' : 'Commit to thread'}
          </button>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
