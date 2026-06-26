import * as React from 'react';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';

type ModelBrowserPivot = 'provider' | 'family';

interface ModelBrowserModalProps {
  open: boolean;
  scope: ModelScope;
  options: ModelOption[];
  value?: string;
  label: string;
  onClose: () => void;
  onSelect: (scope: ModelScope, modelId: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  'aion-labs': 'Aion Labs',
  'anthropic': 'Anthropic',
  'arcee-ai': 'Arcee',
  'deepcogito': 'DeepCogito',
  'deepseek': 'DeepSeek',
  'google': 'Google',
  'inclusionai': 'InclusionAI',
  'mistralai': 'Mistral',
  'moonshotai': 'Moonshot',
  'nousresearch': 'Nous Research',
  'openai': 'OpenAI',
  'qwen': 'Qwen',
  'sao10k': 'Sao10K',
  'stepfun': 'StepFun',
  'thedrummer': 'TheDrummer',
  'x-ai': 'xAI',
  'z-ai': 'Z.AI',
};

const getProviderId = (model: ModelOption): string => model.provider ?? model.id.split('/')[0] ?? 'custom';

const getProviderLabel = (provider: string): string => {
  return PROVIDER_LABELS[provider] ?? provider;
};

const getGroupLabel = (model: ModelOption, pivot: ModelBrowserPivot): string => {
  if (pivot === 'family') {
    return model.family ?? 'Other';
  }
  return getProviderLabel(getProviderId(model));
};

const formatReleaseDate = (releaseDate?: string): string | undefined => {
  if (!releaseDate) {
    return undefined;
  }
  return releaseDate.slice(0, 7);
};

const formatPrice = (price?: string): string => {
  const value = Number(price);
  if (!Number.isFinite(value)) {
    return '-';
  }

  const perMillion = value * 1_000_000;
  if (perMillion >= 10) {
    return `$${Math.round(perMillion).toLocaleString()}`;
  }
  if (perMillion >= 1) {
    return `$${perMillion.toFixed(2).replace(/\.00$/, '')}`;
  }
  return `$${perMillion.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`;
};

const formatContext = (contextLength?: number): string | undefined => {
  if (!contextLength || !Number.isFinite(contextLength)) {
    return undefined;
  }

  if (contextLength >= 1_000_000) {
    const millions = contextLength / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M ctx`;
  }

  if (contextLength >= 1_000) {
    return `${Math.round(contextLength / 1_000)}K ctx`;
  }

  return `${contextLength.toLocaleString()} ctx`;
};

const normalize = (value: string | undefined): string => value?.toLowerCase() ?? '';

const modelMatchesSearch = (model: ModelOption, query: string): boolean => {
  if (!query) {
    return true;
  }

  const haystack = [
    model.id,
    model.label,
    model.description,
    model.family,
    getProviderLabel(getProviderId(model)),
    getProviderId(model),
  ].map(normalize).join(' ');

  return haystack.includes(query);
};

const sortModels = (a: ModelOption, b: ModelOption): number => {
  const dateCompare = (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
  if (dateCompare !== 0) {
    return dateCompare;
  }
  return a.label.localeCompare(b.label);
};

export const ModelBrowserModal: React.FC<ModelBrowserModalProps> = ({
  open,
  scope,
  options,
  value,
  label,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = React.useState('');
  const [pivot, setPivot] = React.useState<ModelBrowserPivot>('provider');
  const [activeGroup, setActiveGroup] = React.useState('All');

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    setActiveGroup('All');
  }, [pivot]);

  if (!open) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredModels = options
    .filter(model => modelMatchesSearch(model, normalizedQuery))
    .sort(sortModels);

  const groups = Array.from(new Set(filteredModels.map(model => getGroupLabel(model, pivot))))
    .sort((a, b) => a.localeCompare(b));

  const groupCounts = new Map<string, number>();
  filteredModels.forEach(model => {
    const group = getGroupLabel(model, pivot);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  });

  const visibleGroups = activeGroup === 'All' ? groups : groups.filter(group => group === activeGroup);

  const selectModel = (modelId: string) => {
    onSelect(scope, modelId);
    onClose();
  };

  return (
    <div className="tm-backdrop" role="dialog" aria-modal="true" aria-label={`${label} browser`} onClick={onClose}>
      <div className="tm mb" onClick={(event) => event.stopPropagation()}>
        <div className="tm-head mb-head">
          <div>
            <div className="pm-eyebrow">{label}</div>
            <div className="tm-title">Choose a Model</div>
            <div className="tm-subtitle">Pricing, release dates, and context windows are loaded from OpenRouter.</div>
          </div>
          <button type="button" className="btn ghost tm-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <label className="mb-search" aria-label="Search models">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models, providers, families..."
          />
        </label>

        <div className="mb-pivots" role="tablist" aria-label="Model grouping">
          <button
            type="button"
            role="tab"
            aria-selected={pivot === 'provider'}
            className={`mb-pivot ${pivot === 'provider' ? 'active' : ''}`}
            onClick={() => setPivot('provider')}
          >
            By Provider
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pivot === 'family'}
            className={`mb-pivot ${pivot === 'family' ? 'active' : ''}`}
            onClick={() => setPivot('family')}
          >
            By Family
          </button>
        </div>

        <div className="mb-chips" aria-label="Model groups">
          <button
            type="button"
            className={`mb-chip ${activeGroup === 'All' ? 'active' : ''}`}
            onClick={() => setActiveGroup('All')}
          >
            All <span>{filteredModels.length}</span>
          </button>
          {groups.map(group => (
            <button
              type="button"
              key={group}
              className={`mb-chip ${activeGroup === group ? 'active' : ''}`}
              onClick={() => setActiveGroup(group)}
            >
              {group} <span>{groupCounts.get(group) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="mb-list">
          {visibleGroups.length === 0 && (
            <div className="mb-empty">No models match that search.</div>
          )}
          {visibleGroups.map(group => {
            const models = filteredModels.filter(model => getGroupLabel(model, pivot) === group);
            return (
              <React.Fragment key={group}>
                <div className="pm-rule-row mb-rule">
                  <span className="pm-eyebrow">{group}</span>
                  <span className="mb-count">{models.length}</span>
                  <hr />
                </div>
                <div className="mb-grid">
                  {models.map(model => {
                    const selected = model.id === value;
                    const context = formatContext(model.contextLength);
                    const releaseDate = formatReleaseDate(model.releaseDate);
                    return (
                      <button
                        type="button"
                        key={model.id}
                        className={`tm-card mb-card ${selected ? 'selected' : ''}`}
                        onClick={() => selectModel(model.id)}
                      >
                        {selected && (
                          <span className="mb-selected" aria-hidden="true">
                            <Icon name="check" size={13} />
                          </span>
                        )}
                        <span className="mb-card-head">
                          <span className="tm-n">{model.label}</span>
                          <span className={`mb-price ${model.pricingAvailable ? '' : 'unavailable'}`}>
                            {model.pricingAvailable && model.pricing ? (
                              <>
                                <strong>{formatPrice(model.pricing.prompt)}</strong>
                                <span>/</span>
                                <strong>{formatPrice(model.pricing.completion)}</strong>
                                <em>per 1M</em>
                              </>
                            ) : (
                              <>
                                <strong>-</strong>
                                <span>/</span>
                                <strong>-</strong>
                                <em>pricing unavailable</em>
                              </>
                            )}
                          </span>
                        </span>
                        <span className="mb-badges">
                          {model.family && <span className="mb-badge">{model.family}</span>}
                          {releaseDate && <span className="mb-badge">{releaseDate}</span>}
                          {context && <span className="mb-badge accent">{context}</span>}
                          {model.knowledgeCutoff && <span className="mb-badge">cutoff {model.knowledgeCutoff}</span>}
                          {model.expirationDate && <span className="mb-badge warn">expires {model.expirationDate}</span>}
                        </span>
                        <span className="tm-d mb-desc">{model.description ?? model.id}</span>
                      </button>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="mb-foot">
          <span className="mb-live-dot" />
          <span>OpenRouter</span>
          <span>{options.length} models</span>
          <span>prices per 1M tokens (input / output)</span>
        </div>
      </div>
    </div>
  );
};
