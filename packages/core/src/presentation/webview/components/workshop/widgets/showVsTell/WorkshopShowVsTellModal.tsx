/**
 * WorkshopShowVsTellModal — the Show vs. Tell Playground's authoring surface
 * (Sprint 05, Slice 3; design Spread 04).
 *
 * Move one beat along a five-position continuum between telling and showing,
 * see what each distance gains and costs, and keep what lands. Both ends are
 * tools: nothing here scores, ranks, or colour-codes either end as better, and
 * nothing is ever inserted into the editor.
 *
 * CONTROLLED presentation. The draft, invalidation rules, and every blocker
 * live in the authoring controller; this component renders what it is given
 * and raises semantic callbacks. Commit is enabled exactly when the controller
 * reports no blockers, and a disabled Commit always names why.
 *
 * Layout (Slice 7 design edits, D1): the beat; then the constraints (POV, the
 * optional must survive, must not change) beside the channels and length
 * budget; then the full-width surrounding passage; then the full-width
 * context multi-select; then the continuum.
 */

import * as React from 'react';
import type {
  WorkshopShowVsTellCarryMode,
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellLengthBudget,
  WorkshopShowVsTellPovMode,
  WorkshopShowVsTellWorkupGroup,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import {
  SHOW_VS_TELL_GROUPS,
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import { ShowVsTellChannelsBudget } from './ShowVsTellChannelsBudget';
import { ShowVsTellSheetHeader } from './ShowVsTellSheetHeader';
import { ShowVsTellConstraintsPanel } from './ShowVsTellConstraintsPanel';
import { ShowVsTellContinuumControl } from './ShowVsTellContinuumControl';
import { ShowVsTellPayloadStrip } from './ShowVsTellPayloadStrip';
import { ShowVsTellSurroundingPanel } from './ShowVsTellSurroundingPanel';
import { ShowVsTellVariantCard } from './ShowVsTellVariantCard';
import type {
  ShowVsTellArtifactUsage,
  ShowVsTellAvailableSource,
  ShowVsTellBanner,
  ShowVsTellCommitBlocker,
  ShowVsTellGenerateBlocker,
  ShowVsTellGenerationPhase
} from './showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export interface WorkshopShowVsTellModalProps {
  open: boolean;
  draft: WorkshopShowVsTellDraft;
  generation: ShowVsTellGenerationPhase;
  invalidationNotice: string | null;
  intakeNotice: string | null;
  /** Honest notice when intake had to shorten the surrounding passage. */
  passageNotice: string | null;
  generateBlockers: readonly ShowVsTellGenerateBlocker[];
  commitBlockers: readonly ShowVsTellCommitBlocker[];
  /** True while the host has not yet answered a commit; the sheet is locked. */
  commitPending: boolean;
  /** The host's refusal or a transport failure; the exact draft stays open. */
  commitError: string | null;
  banner: ShowVsTellBanner;
  artifactUsage: ShowVsTellArtifactUsage | null;
  availableSources: readonly ShowVsTellAvailableSource[];
  /** Whether the room has an active excerpt to copy into the passage box. */
  canUsePassageFromExcerpt: boolean;
  onUseSelection: () => void;
  onBeatTextChange: (text: string) => void;
  onPassageTextChange: (text: string) => void;
  onUsePassageFromExcerpt: () => void;
  onUsePassageFromSelection: () => void;
  onToggleSourceReference: (reference: WorkshopWidgetSourceReference) => void;
  onPovModeChange: (mode: WorkshopShowVsTellPovMode) => void;
  onPovFocalCharacterChange: (text: string) => void;
  onMustSurviveChange: (text: string) => void;
  onMustNotChangeChange: (text: string) => void;
  onToggleChannel: (channel: WorkshopShowVsTellChannel) => void;
  onLengthBudgetChange: (budget: WorkshopShowVsTellLengthBudget) => void;
  onPositionChange: (position: NarrativeHandlingPosition) => void;
  onGenerate: () => void;
  onCancelGenerate: () => void;
  onToggleKeep: (variantId: string) => void;
  onCarryModeChange: (variantId: string, mode: WorkshopShowVsTellCarryMode) => void;
  onNoteChange: (note: string) => void;
  onCommit: () => void;
  widgetModelOptions: ModelOption[];
  selectedWidgetModel: string;
  onWidgetModelChange: (modelId: string) => void;
  onOpenWidgetModelBrowser: () => void;
  onClose: () => void;
}

/* eslint-disable @typescript-eslint/naming-convention -- Blocker ids are stable domain literals. */
const GENERATE_BLOCKER_COPY: Record<ShowVsTellGenerateBlocker, string> = {
  'beat-required': 'Add the beat to explore.',
  'source-unavailable': 'Untick the unavailable context source before generating.'
};

const COMMIT_BLOCKER_COPY: Record<ShowVsTellCommitBlocker, string> = {
  'generation-in-flight': 'Generation is still running.',
  'commit-in-flight': 'Committing…',
  'room-run-active': 'Wait for the current Workshop response to finish before committing.',
  'tool-target': 'Switch to a persona target before committing — tool sidecars do not take craft directions.',
  'no-workup': 'Generate a workup before committing.',
  'no-keep': 'Keep at least one variant to commit.',
  'artifact-compilation-failed':
    'The kept variants no longer match this workup. Regenerate before committing.',
  'over-artifact-budget':
    'The commit payload is over its 600-character ceiling — switch variants to direction only, keep fewer, or shorten the note.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const groupFor = (
  kind: WorkshopShowVsTellWorkupGroup['kind'],
  groups: readonly WorkshopShowVsTellWorkupGroup[]
): WorkshopShowVsTellWorkupGroup | undefined => groups.find((group) => group.kind === kind);

export const WorkshopShowVsTellModal: React.FC<WorkshopShowVsTellModalProps> = ({
  open,
  draft,
  generation,
  invalidationNotice,
  intakeNotice,
  passageNotice,
  generateBlockers,
  commitBlockers,
  commitPending,
  commitError,
  banner,
  artifactUsage,
  availableSources,
  canUsePassageFromExcerpt,
  onUseSelection,
  onBeatTextChange,
  onPassageTextChange,
  onUsePassageFromExcerpt,
  onUsePassageFromSelection,
  onToggleSourceReference,
  onPovModeChange,
  onPovFocalCharacterChange,
  onMustSurviveChange,
  onMustNotChangeChange,
  onToggleChannel,
  onLengthBudgetChange,
  onPositionChange,
  onGenerate,
  onCancelGenerate,
  onToggleKeep,
  onCarryModeChange,
  onNoteChange,
  onCommit,
  widgetModelOptions,
  selectedWidgetModel,
  onWidgetModelChange,
  onOpenWidgetModelBrowser,
  onClose
}) => {
  const [modelBrowserOpen, setModelBrowserOpen] = React.useState(false);
  const generating = generation.kind === 'generating';
  const interactionLocked = generating || commitPending;
  const workup = draft.workup;
  const provenance = draft.beat.provenance;
  const povLabel = SHOW_VS_TELL_POV_MODES.find((mode) => mode.id === draft.pov.mode)?.label;
  const focal = draft.pov.focalCharacter.trim();

  const keptById = React.useMemo(
    () => new Map(draft.kept.map((entry) => [entry.variantId, entry.carryMode])),
    [draft.kept]
  );
  const directionCount = draft.kept.filter((entry) => entry.carryMode === 'direction').length;
  const generateDisabled = interactionLocked || generateBlockers.length > 0;
  const activeBlocker = commitBlockers[0] ?? null;
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

  let ordinal = 0;

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-svt-title"
      closeLabel="Close Show vs. Tell Playground"
      className="pm-ws-svt-modal"
      onClose={close}
    >
      <div className="pm-ws-svt">
        <ShowVsTellSheetHeader banner={banner} commitPending={commitPending} />

        <div className="pm-ws-svt-body">
          <div className="pm-ws-svt-field">
            <span className="pm-ws-svt-flabel" id="pm-ws-svt-beat-label">
              Selected beat
              {provenance.kind === 'persona-prefill' ? (
                <em className="pm-ws-svt-src pm-ws-svt-src-pasted">
                  {workshopPersonaLabel(provenance.personaId)} prefill
                  {provenance.editedByWriter ? ' · edited by you' : ''}
                </em>
              ) : provenance.kind === 'excerpt' ? (
                <em className="pm-ws-svt-src">
                  seeded from selection · {provenance.relativePath}
                  {provenance.startLine !== undefined
                    ? ` · L${provenance.startLine}–${provenance.endLine}`
                    : ''}
                </em>
              ) : (
                <em className="pm-ws-svt-src pm-ws-svt-src-pasted">pasted</em>
              )}
              <span className="pm-ws-svt-pov">
                POV: {povLabel}{focal.length > 0 && draft.pov.mode !== 'unspecified' ? ` · ${focal}` : ''}
              </span>
              <button
                type="button"
                className="pm-ws-svt-use-selection"
                disabled={interactionLocked}
                onClick={onUseSelection}
              >
                Use editor selection
              </button>
            </span>
            <input
              type="text"
              aria-labelledby="pm-ws-svt-beat-label"
              aria-required="true"
              value={draft.beat.text}
              maxLength={BUDGET.showVsTellBeatCharacters}
              disabled={interactionLocked}
              placeholder="Select a line in the editor, or paste one beat."
              onChange={(event) => onBeatTextChange(event.target.value)}
            />
            {intakeNotice && (
              <p className="pm-ws-svt-honest" role="status">{intakeNotice}</p>
            )}
          </div>

          <div className="pm-ws-svt-grid">
            <div className="pm-ws-svt-grid-main">
              <ShowVsTellConstraintsPanel
                draft={draft}
                disabled={interactionLocked}
                onPovModeChange={onPovModeChange}
                onPovFocalCharacterChange={onPovFocalCharacterChange}
                onMustSurviveChange={onMustSurviveChange}
                onMustNotChangeChange={onMustNotChangeChange}
              />
            </div>
            <div className="pm-ws-svt-grid-side">
              <ShowVsTellChannelsBudget
                channels={draft.channels}
                lengthBudget={draft.lengthBudget}
                pov={draft.pov}
                disabled={interactionLocked}
                onToggleChannel={onToggleChannel}
                onLengthBudgetChange={onLengthBudgetChange}
              />
            </div>
          </div>

          <ShowVsTellSurroundingPanel
            draft={draft}
            availableSources={availableSources}
            canUsePassageFromExcerpt={canUsePassageFromExcerpt}
            passageNotice={passageNotice}
            disabled={interactionLocked}
            onPassageTextChange={onPassageTextChange}
            onUsePassageFromExcerpt={onUsePassageFromExcerpt}
            onUsePassageFromSelection={onUsePassageFromSelection}
            onToggleSourceReference={onToggleSourceReference}
          />

          <ShowVsTellContinuumControl
            position={draft.position}
            onPositionChange={onPositionChange}
            disabled={commitPending}
          />

          {generating ? (
            <div className="pm-ws-svt-progress">
              <div className="pm-ws-svt-progress-copy" role="status" aria-live="polite">
                <span>
                  {generation.kind === 'generating' && generation.detail
                    ? generation.detail
                    : 'One fast model call'}
                  …
                </span>
                <strong>One fast model call… · closed schema · four groups</strong>
              </div>
              <div className="pm-ws-svt-progress-track" aria-hidden="true"><span /></div>
              <button type="button" onClick={onCancelGenerate}>Cancel generation</button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`pm-ws-svt-gen${workup ? ' pm-ws-svt-gen-ghost' : ''}`}
                disabled={generateDisabled}
                aria-describedby={generateBlockers.length > 0 ? 'pm-ws-svt-gen-reasons' : undefined}
                onClick={onGenerate}
              >
                <Icon name={workup ? 'refresh' : 'sparkle'} size={13} />{' '}
                {workup ? 'Regenerate the workup' : 'Generate the workup'}
              </button>
              {workup && (
                <p className="pm-ws-svt-regen-note">
                  Regenerating replaces every variant and clears kept variants and carry modes.
                </p>
              )}
              {generateBlockers.length > 0 && (
                <p className="pm-ws-svt-gen-reasons" id="pm-ws-svt-gen-reasons">
                  {generateBlockers.map((blocker) => GENERATE_BLOCKER_COPY[blocker]).join(' ')}
                </p>
              )}
            </>
          )}

          {generation.kind === 'failed' && (
            <div className="pm-ws-svt-error" role="alert">{generation.message}</div>
          )}
          {commitError && (
            <div className="pm-ws-svt-error" role="alert">{commitError}</div>
          )}
          {!workup && !generating && invalidationNotice && (
            <p className="pm-ws-svt-empty" role="status">{invalidationNotice}</p>
          )}
          {!workup && !generating && (
            <div className="pm-ws-svt-seam">
              everything above is deterministic scaffold · one model call, fast tier · commit
              never re-runs it
            </div>
          )}

          {workup && (
            <section className="pm-ws-svt-workup" aria-label="Generated workup">
              {SHOW_VS_TELL_GROUPS.map((descriptor) => {
                const group = groupFor(descriptor.kind, workup.groups);
                return (
                  <section
                    key={descriptor.kind}
                    className="pm-ws-svt-group"
                    aria-label={descriptor.header}
                  >
                    <div className="pm-ws-svt-mgh">
                      <span>{descriptor.header}</span>
                      <hr />
                      <span className="pm-ws-svt-mgh-right">{descriptor.subLabel}</span>
                    </div>
                    <div className="pm-ws-svt-cards">
                      {(group?.variants ?? []).map((variant) => {
                        ordinal += 1;
                        const carryMode = keptById.get(variant.id);
                        return (
                          <ShowVsTellVariantCard
                            key={variant.id}
                            variant={variant}
                            ordinal={ordinal}
                            kept={carryMode !== undefined}
                            carryMode={carryMode ?? 'direction'}
                            interactionLocked={interactionLocked}
                            onToggleKeep={onToggleKeep}
                            onCarryModeChange={onCarryModeChange}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <label className="pm-ws-svt-field">
                <span className="pm-ws-svt-flabel">
                  Note to the room <i>optional</i>
                </span>
                <input
                  type="text"
                  value={draft.note}
                  maxLength={BUDGET.showVsTellNoteCharacters}
                  disabled={interactionLocked}
                  placeholder="e.g. the tell can stay if the fulcrum is shown"
                  onChange={(event) => onNoteChange(event.target.value)}
                />
              </label>

              <ShowVsTellPayloadStrip usage={artifactUsage} />
            </section>
          )}
        </div>

        <footer className="pm-ws-svt-foot">
          <div className="pm-ws-svt-model">
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
            {workup && draft.kept.length > 0 && (
              <span className="pm-ws-svt-foot-count">
                · {draft.kept.length} kept
                {directionCount > 0 ? ` · ${directionCount} as direction` : ''}
              </span>
            )}
          </div>
          <p className="pm-ws-svt-editor-note">
            Nothing is inserted into the editor — commit hands directions to the room.
          </p>
          {activeBlocker && activeBlocker !== 'commit-in-flight' && (
            <span className="pm-ws-svt-commit-reason" id="pm-ws-svt-commit-reason">
              {COMMIT_BLOCKER_COPY[activeBlocker]}
            </span>
          )}
          <button
            type="button"
            className="pm-ws-svt-cancel"
            disabled={commitPending}
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pm-ws-svt-commit"
            disabled={commitDisabled}
            aria-describedby={
              activeBlocker && activeBlocker !== 'commit-in-flight'
                ? 'pm-ws-svt-commit-reason'
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
