/** Lexical Gravity pre-commit sheet — approved Spread 02 translated to React. */

import * as React from 'react';
import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidatesPayload,
  WorkshopLexicalGravityLensIncompatibility,
  WorkshopLexicalGravityLensesSavedPayload,
  WorkshopLexicalGravityPreviewResultPayload,
  WorkshopWidgetActionResultPayload
} from '@messages';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import {
  LEXICAL_GRAVITY_REACH,
  LEXICAL_GRAVITY_WEIGHT
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';
import {
  lexicalGravityLensSlug
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import type {
  WorkshopLexicalGravityOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import {
  WorkshopLexicalGravityLensLogic
} from '@components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityLensLogic';
import {
  WorkshopLexicalGravityPreviewReading
} from '@components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityPreviewReading';

interface WorkshopLexicalGravityModalProps {
  open: boolean;
  opening: WorkshopLexicalGravityOpening;
  lenses: WorkshopLexicalGravityLens[];
  incompatibleResources: WorkshopLexicalGravityLensIncompatibility[];
  storagePath?: string;
  catalogError?: string;
  previewResult: WorkshopLexicalGravityPreviewResultPayload | null;
  lensCandidates: WorkshopLexicalGravityLensCandidatesPayload | null;
  lensesSaved: WorkshopLexicalGravityLensesSavedPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
  onRequestLenses: () => void;
  onPreview: (
    token: string,
    draft: WorkshopLexicalGravityDraft,
    sourceText: string
  ) => void;
  onBuildLens: (token: string, query: string, rebuildResourceName?: string) => void;
  onSaveLenses: (token: string, query: string, candidateIds: string[]) => void;
  onApply: (draft: WorkshopLexicalGravityDraft, widgetConfigId?: string) => void;
  onClearTransientResults: () => void;
  onConsumeActionResult: () => void;
  widgetModelOptions: ModelOption[];
  selectedWidgetModel: string;
  onWidgetModelChange: (modelId: string) => void;
  onOpenWidgetModelBrowser: () => void;
  onClose: () => void;
}

const previewSourceOverrideFor = (
  preview: WorkshopLexicalGravityDraft['preview'] | undefined,
  lensSample: string | undefined
): string | undefined => preview?.sourceText !== undefined && preview.sourceText !== lensSample
  ? preview.sourceText
  : undefined;

type LensTab = 'field' | 'gradient' | 'substitutions' | 'cliches';
type WordPart = 'nouns' | 'verbs' | 'modifiers';
type LensPickerTab = 'create' | 'library';

let lexicalTokenCounter = 0;
const mintToken = (kind: string): string =>
  `lexical-${kind}-${Date.now()}-${++lexicalTokenCounter}`;
const PREVIEW_SOURCE_MIN_HEIGHT = 74;
const PREVIEW_SOURCE_HEIGHT_CAP = 240;

const weightLabel = (weight: number): string =>
  weight <= 15 ? 'trace' : weight <= 35 ? 'subtle' : weight <= 65 ? 'forward' : weight <= 85 ? 'insistent' : 'saturating';
const reachLabel = (reach: number): string =>
  reach === 1 ? 'core vocabulary only' : reach === 2 ? 'core + adjacent' : 'core + far associations';

const humanizeLensSlug = (slug: string): string => slug.replace(/-/g, ' ');

const originalSearchTermFor = (
  lens: WorkshopLexicalGravityLens,
  library: WorkshopLexicalGravityLens[]
): string | undefined => {
  if (lens.source !== 'project') {return undefined;}
  if (lens.originQuery) {return lens.originQuery;}

  const variantSlug = lexicalGravityLensSlug(lens.variant ?? '');
  const variantSuffix = variantSlug ? `-${variantSlug}` : '';
  if (variantSuffix && lens.slug.endsWith(variantSuffix)) {
    return humanizeLensSlug(lens.slug.slice(0, -variantSuffix.length));
  }

  const inferredRoot = library
    .filter(({ source }) => source === 'project')
    .filter((root) => library.some(
      (other) => other.slug !== root.slug && other.slug.startsWith(`${root.slug}-`)
    ))
    .filter((root) => lens.slug === root.slug || lens.slug.startsWith(`${root.slug}-`))
    .sort((left, right) => right.slug.length - left.slug.length)[0];
  return humanizeLensSlug(inferredRoot?.slug ?? lens.slug);
};

const SUBSTITUTIONS = [
  ['plan', 'a plan'],
  ['conflict', 'conflict'],
  ['agreement', 'agreement'],
  ['turning', 'turning point'],
  ['ending', 'an ending']
] as const;

export const WorkshopLexicalGravityModal: React.FC<WorkshopLexicalGravityModalProps> = ({
  open,
  opening,
  lenses,
  incompatibleResources,
  storagePath,
  catalogError,
  previewResult,
  lensCandidates,
  lensesSaved,
  actionResult,
  onRequestLenses,
  onPreview,
  onBuildLens,
  onSaveLenses,
  onApply,
  onClearTransientResults,
  onConsumeActionResult,
  widgetModelOptions,
  selectedWidgetModel,
  onWidgetModelChange,
  onOpenWidgetModelBrowser,
  onClose
}) => {
  const initialDraft = opening.kind === 'edit'
    ? opening.config.draft
    : opening.kind === 'new'
      ? opening.seed
      : undefined;
  const initialSeed = opening.kind === 'seed' ? opening.seed : initialDraft;
  const [lensSlug, setLensSlug] = React.useState(initialSeed?.lensSlug ?? 'photography');
  const [applicationMode, setApplicationMode] = React.useState(
    initialDraft?.applicationMode ?? 'interpret'
  );
  const [weight, setWeight] = React.useState(initialSeed?.weight ?? 60);
  const [reach, setReach] = React.useState<1 | 2 | 3>(initialSeed?.reach ?? 2);
  const [metaphorPull, setMetaphorPull] = React.useState(initialSeed?.metaphorPull ?? false);
  const [preview, setPreview] = React.useState(initialDraft?.preview);
  const [previewSourceOverride, setPreviewSourceOverride] = React.useState<string | undefined>(
    previewSourceOverrideFor(initialDraft?.preview, initialDraft?.resolvedLens.sample)
  );
  const [previewVisible, setPreviewVisible] = React.useState(Boolean(initialDraft?.preview));
  const [tab, setTab] = React.useState<LensTab>('field');
  const [wordPart, setWordPart] = React.useState<WordPart>('nouns');
  const [contrastIndex, setContrastIndex] = React.useState(0);
  const [lookup, setLookup] = React.useState('');
  const [pickerTab, setPickerTab] = React.useState<LensPickerTab>('create');
  const [extraLens, setExtraLens] = React.useState<WorkshopLexicalGravityLens>();
  const [previewToken, setPreviewToken] = React.useState<string>();
  const [buildToken, setBuildToken] = React.useState<string>();
  const [selectedCandidateIds, setSelectedCandidateIds] = React.useState<string[]>([]);
  const [savedCandidateIds, setSavedCandidateIds] = React.useState<string[]>([]);
  const [pendingCandidateIds, setPendingCandidateIds] = React.useState<string[]>([]);
  const [savingCandidates, setSavingCandidates] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [buildError, setBuildError] = React.useState<string>();
  const [buildNotice, setBuildNotice] = React.useState<string>();
  const [incompatibleNote, setIncompatibleNote] =
    React.useState<WorkshopLexicalGravityLensIncompatibility>();
  const [rebuildTarget, setRebuildTarget] =
    React.useState<WorkshopLexicalGravityLensIncompatibility>();
  const [modelBrowserOpen, setModelBrowserOpen] = React.useState(false);
  const previewSourceRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) {return;}
    const draft = opening.kind === 'edit'
      ? opening.config.draft
      : opening.kind === 'new'
        ? opening.seed
        : undefined;
    const seed = opening.kind === 'seed' ? opening.seed : draft;
    setLensSlug(seed?.lensSlug ?? 'photography');
    setApplicationMode(draft?.applicationMode ?? 'interpret');
    setWeight(seed?.weight ?? 60);
    setReach(seed?.reach ?? 2);
    setMetaphorPull(seed?.metaphorPull ?? false);
    setPreview(draft?.preview);
    setPreviewSourceOverride(previewSourceOverrideFor(draft?.preview, draft?.resolvedLens.sample));
    setPreviewVisible(Boolean(draft?.preview));
    setTab('field');
    setWordPart('nouns');
    setContrastIndex(0);
    setLookup('');
    setPickerTab(opening.kind === 'new' ? 'create' : 'library');
    setExtraLens(draft?.resolvedLens);
    setPreviewToken(undefined);
    setBuildToken(undefined);
    setSelectedCandidateIds([]);
    setSavedCandidateIds([]);
    setPendingCandidateIds([]);
    setSavingCandidates(false);
    setApplying(false);
    setError(undefined);
    setBuildError(undefined);
    setBuildNotice(undefined);
    setIncompatibleNote(undefined);
    setRebuildTarget(undefined);
    onClearTransientResults();
    onRequestLenses();
  }, [open, opening, onClearTransientResults, onRequestLenses]);

  const availableLenses = React.useMemo(() => {
    const bySlug = new Map(lenses.map((lens) => [lens.slug, lens]));
    if (extraLens) {bySlug.set(extraLens.slug, extraLens);}
    return [...bySlug.values()];
  }, [extraLens, lenses]);
  const lens = availableLenses.find((candidate) => candidate.slug === lensSlug)
    ?? extraLens
    ?? availableLenses[0];
  const contrasts = availableLenses.filter((candidate) => candidate.slug !== lens?.slug);
  const contrast = contrasts[contrastIndex % Math.max(contrasts.length, 1)];
  const previewSource = previewSourceOverride ?? lens?.sample ?? '';
  const draft: WorkshopLexicalGravityDraft | undefined = lens ? {
    lensSlug: lens.slug,
    applicationMode,
    weight,
    reach,
    metaphorPull,
    resolvedLens: lens,
    preview
  } : undefined;
  const directivePreview = draft
    ? buildLexicalGravityDirectiveFrame({ id: 'pd-preview', revision: 1 }, draft)
    : undefined;

  const resizePreviewSource = React.useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) {return;}
    textarea.style.height = 'auto';
    const contentHeight = textarea.scrollHeight;
    const nextHeight = Math.min(
      Math.max(contentHeight, PREVIEW_SOURCE_MIN_HEIGHT),
      PREVIEW_SOURCE_HEIGHT_CAP
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = contentHeight > PREVIEW_SOURCE_HEIGHT_CAP ? 'auto' : 'hidden';
  }, []);

  React.useLayoutEffect(() => {
    if (previewVisible) {resizePreviewSource(previewSourceRef.current);}
  }, [previewSource, previewVisible, resizePreviewSource]);

  React.useEffect(() => {
    if (!previewToken || previewResult?.token !== previewToken) {return;}
    setPreviewToken(undefined);
    if (previewResult.ok && previewResult.preview) {
      setPreview(previewResult.preview);
      setPreviewVisible(true);
      setPreviewSourceOverride(previewSourceOverrideFor(previewResult.preview, lens?.sample));
      setError(undefined);
    } else {
      setError(previewResult.error ?? 'The preview could not be generated.');
    }
  }, [lens?.sample, previewResult, previewToken]);

  React.useEffect(() => {
    if (!buildToken || lensCandidates?.token !== buildToken) {return;}
    if (!lensCandidates.ok) {
      setBuildToken(undefined);
      setBuildError(lensCandidates.error ?? 'The lens could not be built.');
      return;
    }
    setBuildError(undefined);
    if (lensCandidates.existingLens) {
      setExtraLens(lensCandidates.existingLens);
      setLensSlug(lensCandidates.existingLens.slug);
      setPreview(undefined);
      setBuildToken(undefined);
      setSelectedCandidateIds([]);
      setPickerTab('library');
      setBuildNotice(
        `${lensCandidates.existingLens.name} is already ${lensCandidates.existingLens.source === 'project' ? 'in the project library' : 'a built-in lens'}, so no model call was needed.`
      );
    }
  }, [buildToken, lensCandidates]);

  React.useEffect(() => {
    if (
      !buildToken
      || lensesSaved?.token !== buildToken
      || !savingCandidates
      || lensesSaved.candidateIds.length !== pendingCandidateIds.length
      || !lensesSaved.candidateIds.every((candidateId) => pendingCandidateIds.includes(candidateId))
    ) {return;}
    setSavingCandidates(false);
    setPendingCandidateIds([]);
    if (lensesSaved.ok && lensesSaved.lenses?.length) {
      const firstSavedLens = lensesSaved.lenses[0];
      setExtraLens(firstSavedLens);
      setLensSlug(firstSavedLens.slug);
      setPreview(undefined);
      setSavedCandidateIds((current) => [
        ...new Set([...current, ...lensesSaved.candidateIds])
      ]);
      if ((lensesSaved.remainingCandidateIds?.length ?? 0) === 0) {
        setBuildToken(undefined);
        setPickerTab('library');
      }
      setSelectedCandidateIds([]);
      setBuildError(undefined);
      setBuildNotice(undefined);
      setRebuildTarget(undefined);
      onRequestLenses();
    } else {
      setBuildError(lensesSaved.error ?? 'The project lenses could not be saved.');
    }
  }, [buildToken, lensesSaved, onRequestLenses, pendingCandidateIds, savingCandidates]);

  React.useEffect(() => {
    if (!applying || !actionResult || actionResult.action !== 'apply-standing') {return;}
    setApplying(false);
    onConsumeActionResult();
    if (actionResult.ok) {
      onClose();
    } else {
      setError(actionResult.message ?? 'Lexical Gravity could not be applied.');
    }
  }, [actionResult, applying, onClose, onConsumeActionResult]);

  const invalidatePreview = React.useCallback(() => {
    setPreview(undefined);
    setError(undefined);
  }, []);
  const selectLens = React.useCallback((next: WorkshopLexicalGravityLens) => {
    setExtraLens(next.source === 'project' ? next : undefined);
    setLensSlug(next.slug);
    setContrastIndex(0);
    setIncompatibleNote(undefined);
    setRebuildTarget(undefined);
    invalidatePreview();
  }, [invalidatePreview]);
  const rebuildIncompatible = React.useCallback(
    (resource: WorkshopLexicalGravityLensIncompatibility) => {
      setIncompatibleNote(undefined);
      setLookup(resource.rebuildQuery);
      setRebuildTarget(resource);
      setPickerTab('create');
    },
    []
  );
  const build = React.useCallback(() => {
    if (!lookup.trim() || buildToken) {return;}
    const token = mintToken('build');
    setBuildToken(token);
    setSelectedCandidateIds([]);
    setSavedCandidateIds([]);
    setPendingCandidateIds([]);
    setSavingCandidates(false);
    setError(undefined);
    setBuildError(undefined);
    setBuildNotice(undefined);
    onBuildLens(token, lookup.trim(), rebuildTarget?.resourceName);
  }, [buildToken, lookup, onBuildLens, rebuildTarget]);
  const toggleCandidate = React.useCallback((candidateId: string) => {
    if (savingCandidates) {return;}
    setSelectedCandidateIds((current) => current.includes(candidateId)
      ? current.filter((selectedId) => selectedId !== candidateId)
      : rebuildTarget
        ? [candidateId]
        : [...current, candidateId]);
  }, [rebuildTarget, savingCandidates]);
  const requestPreview = React.useCallback(() => {
    const sourceText = previewSource.trim();
    if (!draft || !sourceText || previewToken) {return;}
    const token = mintToken('preview');
    setPreviewToken(token);
    setPreviewVisible(true);
    setPreview(undefined);
    setError(undefined);
    onPreview(token, { ...draft, preview: undefined }, sourceText);
  }, [draft, onPreview, previewSource, previewToken]);
  const apply = React.useCallback(() => {
    if (!draft || applying) {return;}
    setApplying(true);
    setError(undefined);
    onApply(draft, opening.kind === 'edit' ? opening.config.id : undefined);
  }, [applying, draft, onApply, opening]);
  const close = React.useCallback(() => {
    if (!modelBrowserOpen && !applying) {onClose();}
  }, [applying, modelBrowserOpen, onClose]);
  const changeModel = React.useCallback((_scope: ModelScope, modelId: string) => {
    if (modelId !== selectedWidgetModel) {
      invalidatePreview();
      onWidgetModelChange(modelId);
    }
  }, [invalidatePreview, onWidgetModelChange, selectedWidgetModel]);
  const candidates = buildToken && lensCandidates?.token === buildToken
    ? lensCandidates.candidates?.filter(
        ({ candidateId }) => !savedCandidateIds.includes(candidateId)
      )
    : undefined;
  const buildingLensCandidates = Boolean(
    buildToken && lensCandidates?.token !== buildToken
  );
  const saveSelectedCandidates = React.useCallback(() => {
    if (!buildToken || !candidates || selectedCandidateIds.length < 1 || savingCandidates) {
      return;
    }
    const selectedIds = candidates
      .filter(({ candidateId }) => selectedCandidateIds.includes(candidateId))
      .map(({ candidateId }) => candidateId);
    if (selectedIds.length < 1) {return;}
    setSavingCandidates(true);
    setPendingCandidateIds(selectedIds);
    setBuildError(undefined);
    onSaveLenses(buildToken, lookup.trim(), selectedIds);
  }, [buildToken, candidates, lookup, onSaveLenses, savingCandidates, selectedCandidateIds]);
  const locked = applying || savingCandidates;
  const previewControlsLocked = locked || !!previewToken;

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-lexical-gravity-title"
      closeLabel="Close Lexical Gravity"
      className="pm-ws-gesture-modal pm-ws-lexical-gravity-modal"
      onClose={close}
    >
      <div className="pm-ws-gesture pm-ws-lg">
        <header className="pm-ws-gesture-head">
          <div className="pm-ws-eyebrow pm-ws-gesture-eyebrow">
            Widget <span className="pm-ws-sb-railtag pm-ws-sb-railtag-standing">standing · prose directive</span>
          </div>
          <h2 id="pm-ws-lexical-gravity-title"><Icon name="orbit" size={17} /> Lexical Gravity</h2>
          <p className="pm-ws-gesture-sub">
            Read or reshape the passage through an interpretive lens. Installs a <b>passage-scoped directive</b> consulted only when prose is written — a knob on the <b>work</b>, never on the participant.
          </p>
          {opening.kind === 'edit' && (
            <div className="pm-ws-gesture-banner pm-ws-gesture-banner-clone">
              <Icon name="refresh" size={13} />
              <span><b>Editing the live directive.</b> There is one active directive per family. Apply updates the standing frame between runs; changes stay local until then.</span>
            </div>
          )}
          {opening.kind === 'seed' && (
            <div className="pm-ws-gesture-banner pm-ws-gesture-banner-seed">
              <Icon name="sparkle" size={13} />
              <span><b>Recommended and prefilled by {opening.personaLabel}.</b> Proposing is as far as a persona goes — standing state is always writer-committed.</span>
            </div>
          )}
          <WorkshopModalShell.CloseButton />
        </header>

        <div className="pm-ws-gesture-body pm-ws-lg-body">
          <div className="pm-ws-lg-field">
            <div className="pm-ws-lg-picker-tabs" role="tablist" aria-label="Choose a lens source">
              <button
                type="button"
                id="pm-ws-lg-create-tab"
                role="tab"
                aria-controls="pm-ws-lg-create-panel"
                aria-selected={pickerTab === 'create'}
                className={pickerTab === 'create' ? 'is-on' : ''}
                onClick={() => setPickerTab('create')}
              >
                <Icon name="sparkle" size={12} /> Create New
              </button>
              <button
                type="button"
                id="pm-ws-lg-library-tab"
                role="tab"
                aria-controls="pm-ws-lg-library-panel"
                aria-selected={pickerTab === 'library'}
                className={pickerTab === 'library' ? 'is-on' : ''}
                onClick={() => setPickerTab('library')}
              >
                <Icon name="orbit" size={12} /> Library <span>{availableLenses.length}</span>
              </button>
            </div>
            {buildNotice && <div className="pm-ws-lg-note">{buildNotice}</div>}
            {lensesSaved?.ok && lensesSaved.lenses?.some(({ slug }) => slug === lens?.slug) && (
              <div className="pm-ws-lg-saved">
                <Icon name="check" size={12} />
                {lensesSaved.replacedResourceName
                  ? <>Rebuilt and replaced <code>{lensesSaved.replacedResourceName}</code> in place</>
                  : <>Saved {lensesSaved.lenses.length} {lensesSaved.lenses.length === 1 ? 'lens' : 'lenses'} to project — <code>{storagePath}</code> · available in every session, every thread</>}
              </div>
            )}
            {pickerTab === 'create' && (
              <div
                id="pm-ws-lg-create-panel"
                className="pm-ws-lg-picker-panel"
                role="tabpanel"
                aria-labelledby="pm-ws-lg-create-tab"
              >
                <div className="pm-ws-lg-section-title">Build a lens from any comparison, subject, or field.</div>
                {rebuildTarget && (
                  <div className="pm-ws-lg-note-v1 pm-ws-lg-rebuild-target" role="status">
                    One selected take will atomically replace <code>{rebuildTarget.resourceName}</code>. The old file remains intact unless the replacement succeeds.
                    <button
                      type="button"
                      disabled={!!buildToken}
                      onClick={() => setRebuildTarget(undefined)}
                    >
                      Cancel replacement
                    </button>
                  </div>
                )}
                <div className="pm-ws-lg-lookup">
                  <input
                    value={lookup}
                    disabled={locked || !!buildToken}
                    maxLength={PROMPT_BUDGETS.workshopWidgets.lexicalBuildQueryCharacters}
                    placeholder="Try “code vs. prose”…"
                    onChange={(event) => setLookup(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') {build();} }}
                  />
                  <button type="button" disabled={locked || !lookup.trim() || !!buildToken} onClick={build}>
                    <Icon name="sparkle" size={12} /> {buildToken ? 'Drafting…' : rebuildTarget ? 'Build replacements' : 'Build lens'}
                  </button>
                </div>
                {buildError && <div className="pm-ws-gesture-error pm-ws-lg-build-error" role="alert">{buildError}</div>}
                {buildingLensCandidates && (
                  <div
                    className="pm-ws-lg-options pm-ws-lg-options-loading"
                    role="status"
                    aria-label="Drafting three lens options"
                  >
                    <div className="pm-ws-lg-cap">model drafting 3 takes…</div>
                    {[0, 1, 2].map((slot) => (
                      <div className="pm-ws-lg-option-skeleton" aria-hidden="true" key={slot}>
                        <i />
                        <div><b /><span /></div>
                      </div>
                    ))}
                  </div>
                )}
                {candidates && (
                  <div className="pm-ws-lg-options">
                    <div className="pm-ws-lg-cap">
                      model drafted {candidates.length} takes — {rebuildTarget ? 'select exactly one to replace the legacy lens' : 'select one or more to add'}
                    </div>
                    {candidates.map((candidate) => (
                      <button
                        type="button"
                        aria-pressed={selectedCandidateIds.includes(candidate.candidateId)}
                        className={selectedCandidateIds.includes(candidate.candidateId) ? 'is-selected' : undefined}
                        key={candidate.candidateId}
                        disabled={savingCandidates}
                        onClick={() => toggleCandidate(candidate.candidateId)}
                      >
                        <i className="pm-ws-lg-option-check" aria-hidden="true">
                          {selectedCandidateIds.includes(candidate.candidateId) && <Icon name="check" size={11} />}
                        </i>
                        <b>{candidate.lens.name}{candidate.lens.variant ? ` — ${candidate.lens.variant}` : ''}</b>
                        <span>{candidate.lens.description ?? candidate.lens.gradient.join(' → ')}</span>
                      </button>
                    ))}
                    <div className="pm-ws-lg-option-actions">
                      <span>
                        {selectedCandidateIds.length} selected
                        {savedCandidateIds.length > 0 && ` · ${savedCandidateIds.length} already added`}
                      </span>
                      <button
                        type="button"
                        disabled={selectedCandidateIds.length < 1 || savingCandidates}
                        onClick={saveSelectedCandidates}
                      >
                        <Icon name={rebuildTarget ? 'refresh' : 'plus'} size={12} />
                        {savingCandidates
                          ? rebuildTarget ? 'Replacing…' : 'Adding…'
                          : selectedCandidateIds.length < 1
                            ? rebuildTarget ? 'Choose one replacement' : 'Add selected lenses'
                            : rebuildTarget
                              ? `Replace ${rebuildTarget.resourceName}`
                              : `Add ${selectedCandidateIds.length} selected ${selectedCandidateIds.length === 1 ? 'lens' : 'lenses'}`}
                      </button>
                    </div>
                    <div className="pm-ws-lg-cap">
                      {rebuildTarget
                        ? 'The chosen take keeps this filename; the other takes are discarded after replacement.'
                        : 'Unsaved takes stay available until you close this sheet.'}
                    </div>
                  </div>
                )}
              </div>
            )}
            {pickerTab === 'library' && (
              <div
                id="pm-ws-lg-library-panel"
                className="pm-ws-lg-picker-panel"
                role="tabpanel"
                aria-labelledby="pm-ws-lg-library-tab"
              >
                <div className="pm-ws-gesture-flabel pm-ws-lg-library-label">
                  Choose a lens <i>built-ins + project lenses · blending is Sprint 04</i>
                </div>
                {catalogError && <div className="pm-ws-lg-note">Built-ins remain available. {catalogError}</div>}
                <div className="pm-ws-lg-lenswrap">
                  <div className="pm-ws-lg-lenses">
                    {availableLenses.map((candidate) => {
                      const displayName = `${candidate.name}${candidate.variant ? ` — ${candidate.variant}` : ''}`;
                      const originalSearchTerm = originalSearchTermFor(candidate, availableLenses);
                      return (
                        <button
                          type="button"
                          className={`pm-ws-lg-lens${originalSearchTerm ? ' has-search-term' : ''}${candidate.slug === lens?.slug ? ' is-selected' : ''}`}
                          key={candidate.slug}
                          title={displayName}
                          disabled={previewControlsLocked}
                          onClick={() => selectLens(candidate)}
                        >
                          {originalSearchTerm && (
                            <span className="pm-ws-lg-lens-search-term">{originalSearchTerm}</span>
                          )}
                          <Icon name="orbit" size={15} />
                          <span className="pm-ws-lg-lens-name">
                            {displayName}
                            {candidate.source === 'project' && <em>project</em>}
                          </span>
                          <span className="pm-ws-lg-lens-words">{candidate.degrees[1].nouns.slice(0, 3).join(' · ')}</span>
                        </button>
                      );
                    })}
                    {incompatibleResources.map((resource) => (
                      <button
                        type="button"
                        className={`pm-ws-lg-lens is-v1${incompatibleNote?.resourceName === resource.resourceName ? ' is-selected' : ''}`}
                        key={resource.resourceName}
                        title={resource.resourceName}
                        onClick={() => setIncompatibleNote(resource)}
                      >
                        <Icon name="orbit" size={15} />
                        <span className="pm-ws-lg-lens-name">
                          {resource.rebuildQuery}
                          <em className="pm-ws-lg-v1tag">v1</em>
                        </span>
                        <span className="pm-ws-lg-lens-words">word field only — not installable</span>
                      </button>
                    ))}
                  </div>
                </div>
                {incompatibleNote && (
                  <div className="pm-ws-lg-note-v1" role="note">
                    {incompatibleNote.message}
                    <button type="button" onClick={() => rebuildIncompatible(incompatibleNote)}>
                      Rebuild and overwrite
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {lens && <WorkshopLexicalGravityLensLogic lens={lens} />}

          <div className="pm-ws-lg-application-gear">
            <div>
              <span className="pm-ws-lg-gear-label">Application gear</span>
              <p>
                {applicationMode === 'interpret'
                  ? 'Read through the lens; preserve the passage’s arrangement and sharpen it locally.'
                  : 'Keep the reading, then use it to rebuild beat order, attention, revelation, and syntax.'}
              </p>
            </div>
            <div className="pm-ws-lg-gear-switch" role="group" aria-label="Application gear">
              <button
                type="button"
                aria-pressed={applicationMode === 'interpret'}
                className={applicationMode === 'interpret' ? 'is-selected' : undefined}
                disabled={previewControlsLocked}
                onClick={() => { setApplicationMode('interpret'); invalidatePreview(); }}
              >
                Interpret
              </button>
              <button
                type="button"
                aria-pressed={applicationMode === 'recompose'}
                className={applicationMode === 'recompose' ? 'is-selected' : undefined}
                disabled={previewControlsLocked}
                onClick={() => { setApplicationMode('recompose'); invalidatePreview(); }}
              >
                Recompose
              </button>
            </div>
          </div>

          <label className="pm-ws-lg-slider">
            <span>Reach <b>{reach}° · {reachLabel(reach)}</b></span>
            <input type="range" min={LEXICAL_GRAVITY_REACH.minimum} max={LEXICAL_GRAVITY_REACH.maximum} step={1} value={reach} disabled={previewControlsLocked} onChange={(event) => { setReach(Number(event.target.value) as 1 | 2 | 3); invalidatePreview(); }} />
          </label>
          <div className="pm-ws-lg-toggle-row">
            <div><b>Metaphor pull</b><span>Let images cross domains — not just word choice but figuration drawn through the lens. The interpretive grammar stays active either way.</span></div>
            <button type="button" role="switch" aria-checked={metaphorPull} className={metaphorPull ? 'is-on' : ''} disabled={previewControlsLocked} onClick={() => { setMetaphorPull((value) => !value); invalidatePreview(); }}><i /></button>
          </div>

          {lens && (
            <div className="pm-ws-lg-fieldbox">
              <div className="pm-ws-lg-tabs">
                {([['field', 'Word field'], ['gradient', 'Gradient'], ['substitutions', 'Substitutions'], ['cliches', 'Clichés']] as const).map(([id, label]) => (
                  <button type="button" className={tab === id ? 'is-on' : ''} key={id} onClick={() => setTab(id)}>{label}</button>
                ))}
                <span>{lens.name.toLowerCase()}</span>
              </div>
              {tab === 'field' && (
                <>
                  <div className="pm-ws-lg-pos">
                    {(['nouns', 'verbs', 'modifiers'] as const).map((part) => (
                      <button type="button" className={wordPart === part ? 'is-on' : ''} key={part} onClick={() => setWordPart(part)}>{part}</button>
                    ))}
                  </div>
                  {([1, 2, 3] as const).filter((degree) => degree <= reach).map((degree) => (
                    <div className="pm-ws-lg-degree" key={degree}>
                      <span>{degree}°</span>
                      <div>{lens.degrees[degree][wordPart].map((term) => (
                        <em
                          key={term}
                          style={{
                            opacity: (1 - (degree - 1) * 0.22) * (0.4 + 0.6 * weight / 100)
                          }}
                        >
                          {term}
                        </em>
                      ))}</div>
                    </div>
                  ))}
                  {metaphorPull && <div className="pm-ws-lg-metaphor"><b>metaphor</b>{lens.metaphor}</div>}
                </>
              )}
              {tab === 'gradient' && (
                <><div className="pm-ws-lg-gradient">{lens.gradient.map((term, index) => <React.Fragment key={term}><em>{term}</em>{index < lens.gradient.length - 1 && <span>→</span>}</React.Fragment>)}</div><div className="pm-ws-lg-gradcap">semantic gradient · general → {lens.name.toLowerCase()} · sampled from the field</div></>
              )}
              {tab === 'cliches' && (
                <><div>{lens.cliches.map(({ worn, fresh }) => <div className="pm-ws-lg-cliche" key={worn}><s>{worn}</s><span>→</span><em>{fresh}</em></div>)}</div><div className="pm-ws-lg-gradcap">worn phrases from this lens — the directive steers around them; the refresh column is the field’s own way out</div></>
              )}
              {tab === 'substitutions' && (
                <table className="pm-ws-lg-substitutions"><thead><tr><th>general</th><th>{lens.name.toLowerCase()}</th><th>vs. {contrast?.name.toLowerCase() ?? '—'} <button type="button" title="Shuffle contrast lens" onClick={() => setContrastIndex((value) => value + 1)}>↻</button></th></tr></thead><tbody>{SUBSTITUTIONS.map(([key, label]) => <tr key={key}><td>{label}</td><td>{lens.substitutions[key]}</td><td>{contrast?.substitutions[key] ?? '—'}</td></tr>)}</tbody></table>
              )}
              <div className="pm-ws-lg-fcap">lexical realization layer — deterministic scaffold, no model call, redrawn instantly</div>
            </div>
          )}

          {previewVisible && lens && (
            <div className="pm-ws-lg-preview">
              <div>one fast-tier call · sample pull at {weight}%</div>
              <span className="pm-ws-lg-preview-source">
                <b>Before</b>
                <textarea
                  ref={previewSourceRef}
                  aria-label="Before preview prose"
                  value={previewSource}
                  rows={3}
                  maxLength={PROMPT_BUDGETS.workshopWidgets.lexicalSampleCharacters}
                  disabled={previewControlsLocked}
                  onInput={(event) => resizePreviewSource(event.currentTarget)}
                  onChange={(event) => {
                    setPreviewSourceOverride(event.target.value);
                    setPreview(undefined);
                    setError(undefined);
                  }}
                />
              </span>
              {previewToken && (
                <span
                  className="pm-ws-lg-preview-loading"
                  role="status"
                  aria-label="Generating After preview"
                >
                  <b>After</b>
                  <span className="pm-ws-lg-preview-skeleton" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
              )}
              {preview && (
                <>
                  <WorkshopLexicalGravityPreviewReading lens={lens} preview={preview} />
                  <div className="pm-ws-lg-preview-result">
                    <b>After</b>
                    <MarkdownRenderer
                      content={preview.text}
                      className="pm-ws-lg-preview-markdown"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <label className="pm-ws-lg-slider pm-ws-lg-preview-weight">
            <span>Weight <b>{weight}% · {weightLabel(weight)}</b></span>
            <input type="range" min={LEXICAL_GRAVITY_WEIGHT.minimum} max={LEXICAL_GRAVITY_WEIGHT.maximum} step={LEXICAL_GRAVITY_WEIGHT.step} value={weight} disabled={previewControlsLocked} onChange={(event) => { setWeight(Number(event.target.value)); invalidatePreview(); }} />
          </label>
          <button type="button" className="pm-ws-lg-preview-button" disabled={!draft || !previewSource.trim() || !!previewToken || locked} onClick={requestPreview}>
            <Icon name={preview ? 'refresh' : 'sparkle'} size={12} /> {previewToken ? 'One fast model call…' : preview ? 'Preview again' : 'Preview the Effect'}
          </button>
          {error && <div className="pm-ws-gesture-error" role="alert">{error}</div>}
          {directivePreview && (
            <details className="pm-ws-lg-directive-disclosure">
              <summary>What the room is told</summary>
              <pre>{directivePreview}</pre>
            </details>
          )}
        </div>

        <footer className="pm-ws-gesture-foot">
          <div className="pm-ws-gesture-model">
            <ModelSelector scope="widget" options={widgetModelOptions} value={selectedWidgetModel} onChange={changeModel} onOpenBrowser={onOpenWidgetModelBrowser} onBrowserOpenChange={setModelBrowserOpen} label="Widget Model" disabled={locked || !!previewToken || !!buildToken} />
          </div>
          <button type="button" className="pm-ws-gesture-cancel" disabled={locked} onClick={close}>Cancel</button>
          <button type="button" className="pm-ws-gesture-commit" disabled={!draft || locked || !!previewToken || !!buildToken} onClick={apply}>
            {applying ? 'Applying…' : opening.kind === 'edit' ? 'Apply' : 'Install on passage'}
          </button>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
