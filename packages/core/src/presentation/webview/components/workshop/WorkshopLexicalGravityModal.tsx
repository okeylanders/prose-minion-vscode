/** Lexical Gravity pre-commit sheet — approved Spread 02 translated to React. */

import * as React from 'react';
import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidatesPayload,
  WorkshopLexicalGravityLensesSavedPayload,
  WorkshopLexicalGravityPreviewResultPayload,
  WorkshopLexicalGravityRecommendationSeed,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopWidgetActionResultPayload
} from '@messages';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from './WorkshopModalShell';
import {
  LEXICAL_GRAVITY_REACH,
  LEXICAL_GRAVITY_WEIGHT
} from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/lexicalGravity/LexicalGravityDirective';

export type WorkshopLexicalGravityOpening =
  | { kind: 'new'; seed?: WorkshopLexicalGravityDraft }
  | { kind: 'seed'; seed: WorkshopLexicalGravityRecommendationSeed; personaLabel: string }
  | { kind: 'edit'; config: WorkshopLexicalGravityWidgetConfigSnapshot };

interface WorkshopLexicalGravityModalProps {
  open: boolean;
  opening: WorkshopLexicalGravityOpening;
  lenses: WorkshopLexicalGravityLens[];
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
  onBuildLens: (token: string, query: string) => void;
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

type LensTab = 'field' | 'gradient' | 'substitutions' | 'cliches';
type WordPart = 'nouns' | 'verbs' | 'modifiers';

let lexicalTokenCounter = 0;
const mintToken = (kind: string): string =>
  `lexical-${kind}-${Date.now()}-${++lexicalTokenCounter}`;

const weightLabel = (weight: number): string =>
  weight < 25 ? 'a trace' : weight < 55 ? 'present, not loud' : weight < 85 ? 'forward' : 'saturated';
const reachLabel = (reach: number): string =>
  reach === 1 ? 'core vocabulary only' : reach === 2 ? 'core + adjacent' : 'core + far associations';

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
  const [weight, setWeight] = React.useState(initialSeed?.weight ?? 60);
  const [reach, setReach] = React.useState<1 | 2 | 3>(initialSeed?.reach ?? 2);
  const [metaphorPull, setMetaphorPull] = React.useState(initialSeed?.metaphorPull ?? false);
  const [preview, setPreview] = React.useState(initialDraft?.preview);
  const [previewSourceOverride, setPreviewSourceOverride] = React.useState<string | undefined>(
    initialDraft?.preview?.sourceText !== undefined
      && initialDraft.preview.sourceText !== initialDraft.resolvedLens.sample
      ? initialDraft.preview.sourceText
      : undefined
  );
  const [previewVisible, setPreviewVisible] = React.useState(Boolean(initialDraft?.preview));
  const [tab, setTab] = React.useState<LensTab>('field');
  const [wordPart, setWordPart] = React.useState<WordPart>('nouns');
  const [contrastIndex, setContrastIndex] = React.useState(0);
  const [lookup, setLookup] = React.useState('');
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
  const [modelBrowserOpen, setModelBrowserOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {return;}
    const draft = opening.kind === 'edit'
      ? opening.config.draft
      : opening.kind === 'new'
        ? opening.seed
        : undefined;
    const seed = opening.kind === 'seed' ? opening.seed : draft;
    setLensSlug(seed?.lensSlug ?? 'photography');
    setWeight(seed?.weight ?? 60);
    setReach(seed?.reach ?? 2);
    setMetaphorPull(seed?.metaphorPull ?? false);
    setPreview(draft?.preview);
    setPreviewSourceOverride(
      draft?.preview?.sourceText !== undefined
        && draft.preview.sourceText !== draft.resolvedLens.sample
        ? draft.preview.sourceText
        : undefined
    );
    setPreviewVisible(Boolean(draft?.preview));
    setTab('field');
    setWordPart('nouns');
    setContrastIndex(0);
    setLookup('');
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
    weight,
    reach,
    metaphorPull,
    resolvedLens: lens,
    preview
  } : undefined;
  const directivePreview = draft
    ? buildLexicalGravityDirectiveFrame({ id: 'pd-preview', revision: 1 }, draft)
    : undefined;

  React.useEffect(() => {
    if (!previewToken || previewResult?.token !== previewToken) {return;}
    setPreviewToken(undefined);
    if (previewResult.ok && previewResult.preview) {
      setPreview(previewResult.preview);
      setPreviewVisible(true);
      if (previewResult.preview.sourceText !== undefined) {
        setPreviewSourceOverride(
          previewResult.preview.sourceText === lens?.sample
            ? undefined
            : previewResult.preview.sourceText
        );
      }
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
      }
      setSelectedCandidateIds([]);
      setBuildError(undefined);
      setBuildNotice(undefined);
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
    invalidatePreview();
  }, [invalidatePreview]);
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
    onBuildLens(token, lookup.trim());
  }, [buildToken, lookup, onBuildLens]);
  const toggleCandidate = React.useCallback((candidateId: string) => {
    if (savingCandidates) {return;}
    setSelectedCandidateIds((current) => current.includes(candidateId)
      ? current.filter((selectedId) => selectedId !== candidateId)
      : [...current, candidateId]);
  }, [savingCandidates]);
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
            Pull the passage’s lexis toward an interpretive lens. Installs a <b>passage-scoped directive</b> consulted only when prose is written — a knob on the <b>work</b>, never on the participant.
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
            <div className="pm-ws-lg-section-title">Build New Lens</div>
            <div className="pm-ws-lg-lookup">
              <input
                value={lookup}
                disabled={locked || !!buildToken}
                maxLength={PROMPT_BUDGETS.workshopWidgets.lexicalBuildQueryCharacters}
                placeholder="Look up or invent a lens…"
                onChange={(event) => setLookup(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') {build();} }}
              />
              <button type="button" disabled={locked || !lookup.trim() || !!buildToken} onClick={build}>
                <Icon name="sparkle" size={12} /> {buildToken ? 'Drafting…' : 'Build lens'}
              </button>
            </div>
            {buildError && <div className="pm-ws-gesture-error pm-ws-lg-build-error" role="alert">{buildError}</div>}
            {catalogError && <div className="pm-ws-lg-note">Built-ins remain available. {catalogError}</div>}
            {buildNotice && <div className="pm-ws-lg-note">{buildNotice}</div>}
            {buildingLensCandidates && (
              <div
                className="pm-ws-lg-options pm-ws-lg-options-loading"
                role="status"
                aria-label="Drafting three lens options"
              >
                <div className="pm-ws-lg-cap">model drafting 3 takes…</div>
                {[0, 1, 2].map((slot) => (
                  <div
                    className="pm-ws-lg-option-skeleton"
                    aria-hidden="true"
                    key={slot}
                  >
                    <i />
                    <div><b /><span /></div>
                  </div>
                ))}
              </div>
            )}
            {candidates && (
              <div className="pm-ws-lg-options">
                <div className="pm-ws-lg-cap">
                  model drafted {candidates.length} takes — select one or more to add
                </div>
                {candidates.map((candidate) => (
                  <button
                    type="button"
                    aria-pressed={selectedCandidateIds.includes(candidate.candidateId)}
                    className={selectedCandidateIds.includes(candidate.candidateId)
                      ? 'is-selected'
                      : undefined}
                    key={candidate.candidateId}
                    disabled={savingCandidates}
                    onClick={() => toggleCandidate(candidate.candidateId)}
                  >
                    <i className="pm-ws-lg-option-check" aria-hidden="true">
                      {selectedCandidateIds.includes(candidate.candidateId)
                        && <Icon name="check" size={11} />}
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
                    <Icon name="plus" size={12} />
                    {savingCandidates
                      ? 'Adding…'
                      : selectedCandidateIds.length < 1
                        ? 'Add selected lenses'
                        : `Add ${selectedCandidateIds.length} selected ${selectedCandidateIds.length === 1 ? 'lens' : 'lenses'}`}
                  </button>
                </div>
                <div className="pm-ws-lg-cap">
                  Unsaved takes stay available until you close this sheet.
                </div>
              </div>
            )}
            {lensesSaved?.ok && lensesSaved.lenses?.some(({ slug }) => slug === lens?.slug) && (
              <div className="pm-ws-lg-saved">
                <Icon name="check" size={12} />
                Saved {lensesSaved.lenses.length} {lensesSaved.lenses.length === 1 ? 'lens' : 'lenses'} to project — <code>{storagePath}</code> · available in every session, every thread
              </div>
            )}
            <div className="pm-ws-lg-or"><span>OR</span></div>
            <div className="pm-ws-lg-existing-title">Select From Existing</div>
            <div className="pm-ws-gesture-flabel pm-ws-lg-library-label">
              Lens <i>built-ins + project lenses · blending is Sprint 04</i>
            </div>
            <div className="pm-ws-lg-lenses">
              {availableLenses.map((candidate) => {
                const displayName = `${candidate.name}${candidate.variant ? ` — ${candidate.variant}` : ''}`;
                return (
                  <button
                    type="button"
                    className={`pm-ws-lg-lens${candidate.slug === lens?.slug ? ' is-selected' : ''}`}
                    key={candidate.slug}
                    title={displayName}
                    disabled={previewControlsLocked}
                    onClick={() => selectLens(candidate)}
                  >
                    <span className="pm-ws-lg-lens-name">
                      {displayName}
                      {candidate.source === 'project' && <em>project</em>}
                    </span>
                    <span className="pm-ws-lg-lens-words">{candidate.degrees[1].nouns.slice(0, 3).join(' · ')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="pm-ws-lg-slider">
            <span>Reach <b>{reach}° · {reachLabel(reach)}</b></span>
            <input type="range" min={LEXICAL_GRAVITY_REACH.minimum} max={LEXICAL_GRAVITY_REACH.maximum} step={1} value={reach} disabled={previewControlsLocked} onChange={(event) => { setReach(Number(event.target.value) as 1 | 2 | 3); invalidatePreview(); }} />
          </label>
          <div className="pm-ws-lg-toggle-row">
            <div><b>Metaphor pull</b><span>Let images cross domains — not just word choice but figuration drawn through the lens.</span></div>
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
              <div className="pm-ws-lg-fcap">deterministic scaffold — no model call, redrawn instantly</div>
            </div>
          )}

          {previewVisible && lens && (
            <div className="pm-ws-lg-preview">
              <div>one fast-tier call · sample pull at {weight}%</div>
              <span className="pm-ws-lg-preview-source">
                <b>Before</b>
                <textarea
                  aria-label="Before preview prose"
                  value={previewSource}
                  rows={3}
                  maxLength={PROMPT_BUDGETS.workshopWidgets.lexicalSampleCharacters}
                  disabled={previewControlsLocked}
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
              {preview && <span><b>After</b> “{preview.text}”</span>}
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
