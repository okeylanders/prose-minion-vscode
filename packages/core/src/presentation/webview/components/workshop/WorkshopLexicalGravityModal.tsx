/** Lexical Gravity pre-commit sheet — approved Spread 02 translated to React. */

import * as React from 'react';
import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidate,
  WorkshopLexicalGravityLensCandidatesPayload,
  WorkshopLexicalGravityLensSavedPayload,
  WorkshopLexicalGravityPreviewResultPayload,
  WorkshopLexicalGravityRecommendationSeed,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopWidgetActionResultPayload
} from '@messages';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from './WorkshopModalShell';

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
  lensSaved: WorkshopLexicalGravityLensSavedPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
  onRequestLenses: () => void;
  onPreview: (token: string, draft: WorkshopLexicalGravityDraft) => void;
  onBuildLens: (token: string, query: string) => void;
  onSaveLens: (token: string, query: string, candidate: WorkshopLexicalGravityLensCandidate) => void;
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
  lensSaved,
  actionResult,
  onRequestLenses,
  onPreview,
  onBuildLens,
  onSaveLens,
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
  const [tab, setTab] = React.useState<LensTab>('field');
  const [wordPart, setWordPart] = React.useState<WordPart>('nouns');
  const [contrastIndex, setContrastIndex] = React.useState(0);
  const [lookup, setLookup] = React.useState('falconry');
  const [extraLens, setExtraLens] = React.useState<WorkshopLexicalGravityLens>();
  const [previewToken, setPreviewToken] = React.useState<string>();
  const [buildToken, setBuildToken] = React.useState<string>();
  const [savingCandidateId, setSavingCandidateId] = React.useState<string>();
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string>();
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
    setTab('field');
    setWordPart('nouns');
    setContrastIndex(0);
    setLookup('falconry');
    setExtraLens(draft?.resolvedLens);
    setPreviewToken(undefined);
    setBuildToken(undefined);
    setSavingCandidateId(undefined);
    setApplying(false);
    setError(undefined);
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
  const draft: WorkshopLexicalGravityDraft | undefined = lens ? {
    lensSlug: lens.slug,
    weight,
    reach,
    metaphorPull,
    resolvedLens: lens,
    preview
  } : undefined;

  React.useEffect(() => {
    if (!previewToken || previewResult?.token !== previewToken) {return;}
    setPreviewToken(undefined);
    if (previewResult.ok && previewResult.preview) {
      setPreview(previewResult.preview);
      setError(undefined);
    } else {
      setError(previewResult.error ?? 'The preview could not be generated.');
    }
  }, [previewResult, previewToken]);

  React.useEffect(() => {
    if (!buildToken || lensCandidates?.token !== buildToken) {return;}
    if (!lensCandidates.ok) {
      setBuildToken(undefined);
      setError(lensCandidates.error ?? 'The lens could not be built.');
      return;
    }
    if (lensCandidates.existingLens) {
      setExtraLens(lensCandidates.existingLens);
      setLensSlug(lensCandidates.existingLens.slug);
      setPreview(undefined);
      setBuildToken(undefined);
      setError(undefined);
    }
  }, [buildToken, lensCandidates]);

  React.useEffect(() => {
    if (!buildToken || lensSaved?.token !== buildToken || !savingCandidateId) {return;}
    setSavingCandidateId(undefined);
    setBuildToken(undefined);
    if (lensSaved.ok && lensSaved.lens) {
      setExtraLens(lensSaved.lens);
      setLensSlug(lensSaved.lens.slug);
      setPreview(undefined);
      setError(undefined);
      onRequestLenses();
    } else {
      setError(lensSaved.error ?? 'The project lens could not be saved.');
    }
  }, [buildToken, lensSaved, onRequestLenses, savingCandidateId]);

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
    setSavingCandidateId(undefined);
    setError(undefined);
    onBuildLens(token, lookup.trim());
  }, [buildToken, lookup, onBuildLens]);
  const chooseCandidate = React.useCallback((candidate: WorkshopLexicalGravityLensCandidate) => {
    if (!buildToken || savingCandidateId) {return;}
    setSavingCandidateId(candidate.candidateId);
    onSaveLens(buildToken, lookup.trim(), candidate);
  }, [buildToken, lookup, onSaveLens, savingCandidateId]);
  const requestPreview = React.useCallback(() => {
    if (!draft || previewToken) {return;}
    const token = mintToken('preview');
    setPreviewToken(token);
    setError(undefined);
    onPreview(token, draft);
  }, [draft, onPreview, previewToken]);
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
    ? lensCandidates.candidates
    : undefined;
  const locked = applying;

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
              <span><b>Editing the live directive.</b> There is one active directive per family — Apply swaps the standing frame between runs. Pre-commit tweaking is free; only the commit pays.</span>
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
            <div className="pm-ws-gesture-flabel">Lens <i>built-ins + project lenses · blending is Sprint 04</i></div>
            <div className="pm-ws-lg-lenses">
              {availableLenses.map((candidate) => (
                <button
                  type="button"
                  className={`pm-ws-lg-lens${candidate.slug === lens?.slug ? ' is-selected' : ''}`}
                  key={candidate.slug}
                  disabled={locked}
                  onClick={() => selectLens(candidate)}
                >
                  <span className="pm-ws-lg-lens-name">
                    {candidate.name}
                    {candidate.source === 'project' && <em>project</em>}
                  </span>
                  <span className="pm-ws-lg-lens-words">{candidate.degrees[1].nouns.slice(0, 3).join(' · ')}</span>
                </button>
              ))}
            </div>
            <div className="pm-ws-lg-lookup">
              <input
                value={lookup}
                disabled={locked || !!buildToken}
                placeholder="Look up or invent a lens…"
                onChange={(event) => setLookup(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') {build();} }}
              />
              <button type="button" disabled={locked || !lookup.trim() || !!buildToken} onClick={build}>
                <Icon name="sparkle" size={12} /> {buildToken ? 'Drafting…' : 'Build lens'}
              </button>
            </div>
            {catalogError && <div className="pm-ws-lg-note">Built-ins remain available. {catalogError}</div>}
            {candidates && (
              <div className="pm-ws-lg-options">
                <div className="pm-ws-lg-cap">model drafted {candidates.length} takes — pick one to add</div>
                {candidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.candidateId}
                    disabled={!!savingCandidateId}
                    onClick={() => chooseCandidate(candidate)}
                  >
                    <b>{candidate.lens.name}{candidate.lens.variant ? ` — ${candidate.lens.variant}` : ''}</b>
                    <span>{candidate.lens.description ?? candidate.lens.gradient.join(' → ')}</span>
                  </button>
                ))}
              </div>
            )}
            {lensSaved?.ok && lensSaved.lens?.slug === lens?.slug && (
              <div className="pm-ws-lg-saved"><Icon name="check" size={12} /> Saved to project — <code>{storagePath}/{lens.slug}.json</code> · available in every session, every thread</div>
            )}
          </div>

          <label className="pm-ws-lg-slider">
            <span>Weight <b>{weight}% · {weightLabel(weight)}</b></span>
            <input type="range" min={10} max={100} step={5} value={weight} disabled={locked} onChange={(event) => { setWeight(Number(event.target.value)); invalidatePreview(); }} />
          </label>
          <label className="pm-ws-lg-slider">
            <span>Reach <b>{reach}° · {reachLabel(reach)}</b></span>
            <input type="range" min={1} max={3} step={1} value={reach} disabled={locked} onChange={(event) => { setReach(Number(event.target.value) as 1 | 2 | 3); invalidatePreview(); }} />
          </label>
          <div className="pm-ws-lg-toggle-row">
            <div><b>Metaphor pull</b><span>Let images cross domains — not just word choice but figuration drawn through the lens.</span></div>
            <button type="button" role="switch" aria-checked={metaphorPull} className={metaphorPull ? 'is-on' : ''} disabled={locked} onClick={() => { setMetaphorPull((value) => !value); invalidatePreview(); }}><i /></button>
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

          <button type="button" className="pm-ws-lg-preview-button" disabled={!draft || !!previewToken || locked} onClick={requestPreview}>
            <Icon name={preview ? 'refresh' : 'sparkle'} size={12} /> {previewToken ? 'One fast model call…' : preview ? 'Preview again' : 'Preview the pull'}
          </button>
          {preview && <div className="pm-ws-lg-preview"><div>one fast-tier call · sample pull at {weight}%</div>“{preview.text}”</div>}
          {error && <div className="pm-ws-gesture-error" role="alert">{error}</div>}
        </div>

        <footer className="pm-ws-gesture-foot">
          <div className="pm-ws-gesture-model">
            <ModelSelector scope="widget" options={widgetModelOptions} value={selectedWidgetModel} onChange={changeModel} onOpenBrowser={onOpenWidgetModelBrowser} onBrowserOpenChange={setModelBrowserOpen} label="Widget Model" disabled={locked || !!previewToken || !!buildToken} />
          </div>
          <button type="button" className="pm-ws-gesture-cancel" disabled={locked} onClick={close}>Cancel</button>
          <button type="button" className="pm-ws-gesture-commit" disabled={!draft || locked || !!previewToken || !!buildToken} onClick={apply}>
            {applying ? 'Applying…' : opening.kind === 'edit' ? 'Apply between runs' : 'Install on passage'}
          </button>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
