import * as React from 'react';
import { ModelScope, ModelOption } from '../../../shared/types';

type SettingsOverlayProps = {
  visible: boolean;
  onClose: () => void;
  vscode: any;
  settings: Record<string, string | number | boolean>;
  onUpdate: (key: string, value: string | number | boolean) => void;
  onResetTokens: () => void;
  modelOptions: ModelOption[];
  modelSelections: Partial<Record<ModelScope, string>>;
  onModelChange: (scope: ModelScope, modelId: string) => void;
  publishing: {
    preset: string;
    trimKey: string;
    genres: Array<{ key: string; name: string; abbreviation?: string; pageSizes: Array<{ key: string; label: string }> }>;
    onPresetChange: (preset: string) => void;
    onTrimChange: (key?: string) => void;
  };
};

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  visible,
  onClose,
  vscode,
  settings,
  onUpdate,
  onResetTokens,
  modelOptions,
  modelSelections,
  onModelChange,
  publishing
}) => {
  if (!visible) return null;

  const get = (key: string) => settings[key];
  const asString = (key: string) => String(get(key) ?? '');
  const asNumber = (key: string) => Number(get(key) ?? 0);
  const asBoolean = (key: string) => Boolean(get(key));

  const renderModelSelect = (scope: ModelScope, label: string) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <select
        value={modelSelections[scope] || ''}
        onChange={(e) => onModelChange(scope, e.target.value)}
        style={{
          width: '100%', padding: '6px 8px',
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          border: '1px solid var(--vscode-input-border)',
          borderRadius: 4
        }}
      >
        {modelOptions.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)',
      overflow: 'auto', padding: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        <button onClick={onClose} title="Close"
          style={{ padding: '4px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: '1px solid var(--vscode-button-border, transparent)', borderRadius: 4 }}
          onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-button-hoverBackground)')}
          onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-button-background)')}
        >Close</button>
      </div>

      {/* Connection */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Connection</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>OpenRouter API Key</div>
          <input type="password" value={asString('openRouterApiKey')} onChange={(e) => onUpdate('openRouterApiKey', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          <div style={{ color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
            Requires an OpenRouter pay‑as‑you‑go account for AI features. OpenRouter routes to leading models with configurable privacy (no logging, no training). Learn more at <a href="https://openrouter.ai/" target="_blank" rel="noreferrer">openrouter.ai</a>.
          </div>
        </label>
      </section>

      {/* Models */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Models</h3>
        {renderModelSelect('assistant', 'Assistant Model (Prose / Dialogue)')}
        {renderModelSelect('dictionary', 'Dictionary Model')}
        {renderModelSelect('context', 'Context Assistant Model')}
      </section>

      {/* General */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>General</h3>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <input type="checkbox" checked={asBoolean('includeCraftGuides')} onChange={(e) => onUpdate('includeCraftGuides', e.target.checked)} /> Include Craft Guides
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Adds writing guides to prompts for richer suggestions (uses more tokens).</div>
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Temperature (0–2)</div>
          <input type="number" min={0} max={2} step={0.1} value={asNumber('temperature')} onChange={(e) => onUpdate('temperature', Number(e.target.value))}
            style={{ width: 160, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Higher values increase creativity; lower values are more focused.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Max Tokens</div>
          <input type="number" min={100} max={100000} step={100} value={asNumber('maxTokens')} onChange={(e) => onUpdate('maxTokens', Number(e.target.value))}
            style={{ width: 220, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Sets the maximum response length. Truncation notices appear when the cap is hit.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 4 }}>
          <input type="checkbox" checked={asBoolean('ui.showTokenWidget')} onChange={(e) => onUpdate('ui.showTokenWidget', e.target.checked)} /> Show Token Usage Widget
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Displays session token totals in the header; resets on manual reset or reload.</div>
        </label>
        <div style={{ marginTop: 8 }}>
          <button onClick={onResetTokens} title="Reset session token totals"
            style={{ padding: '6px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: '1px solid var(--vscode-button-border, transparent)', borderRadius: 4 }}
            onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-button-hoverBackground)')}
            onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-button-background)')}
          >Reset Token Usage</button>
        </div>
      </section>

      {/* Publishing Standards */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Publishing Standards</h3>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Preset</div>
          <select
            value={publishing.preset}
            onChange={(e) => publishing.onPresetChange(e.target.value)}
            style={{ width: '100%', maxWidth: 440, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }}
          >
            <option value="none">None</option>
            <option value="manuscript">Manuscript</option>
            {publishing.genres.map(g => (
              <option key={g.key} value={`genre:${g.key}`}>Genre: {g.name}{g.abbreviation ? ` (${g.abbreviation})` : ''}</option>
            ))}
          </select>
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Choose a comparison preset for metrics: a generic manuscript or a specific genre.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Trim Size</div>
          <select
            value={publishing.trimKey}
            onChange={(e) => publishing.onTrimChange(e.target.value || undefined)}
            style={{ width: '100%', maxWidth: 320, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }}
          >
            <option value="">(Default)</option>
            {(publishing.genres.find(g => `genre:${g.key}` === publishing.preset)?.pageSizes || []).map(ps => (
              <option key={ps.key} value={ps.key}>{ps.label}</option>
            ))}
          </select>
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>If a genre is selected, pick a typical trim size for better comparisons.</div>
        </label>
      </section>

      {/* Word Frequency */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Word Frequency</h3>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Top N Words</div>
          <input type="number" min={10} max={1000} value={asNumber('wordFrequency.topN')} onChange={(e) => onUpdate('wordFrequency.topN', Number(e.target.value))}
            style={{ width: 160, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Number of top words to show.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.includeHapaxList')} onChange={(e) => onUpdate('wordFrequency.includeHapaxList', e.target.checked)} /> Include Hapax List
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Hapax words occur exactly once; useful for spotting one-off expressions.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <div>Hapax Display Max</div>
          <input type="number" min={50} max={5000} value={asNumber('wordFrequency.hapaxDisplayMax')} onChange={(e) => onUpdate('wordFrequency.hapaxDisplayMax', Number(e.target.value))}
            style={{ width: 200, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.includeStopwordsTable')} onChange={(e) => onUpdate('wordFrequency.includeStopwordsTable', e.target.checked)} /> Include Stopwords Table
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Shows common function words (the, and, of, …) for balance checks.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.contentWordsOnly')} onChange={(e) => onUpdate('wordFrequency.contentWordsOnly', e.target.checked)} /> Content Words Only
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Exclude stopwords to emphasize nouns, verbs, adjectives, and adverbs.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.posEnabled')} onChange={(e) => onUpdate('wordFrequency.posEnabled', e.target.checked)} /> POS Tagger Enabled
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Enables offline part-of-speech sections; falls back gracefully if unavailable.</div>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.includeBigrams')} onChange={(e) => onUpdate('wordFrequency.includeBigrams', e.target.checked)} /> Include Bigrams
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.includeTrigrams')} onChange={(e) => onUpdate('wordFrequency.includeTrigrams', e.target.checked)} /> Include Trigrams
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <input type="checkbox" checked={asBoolean('wordFrequency.enableLemmas')} onChange={(e) => onUpdate('wordFrequency.enableLemmas', e.target.checked)} /> Enable Lemmas (experimental)
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Group inflected forms under a base form (e.g., running → run).</div>
        </label>
        <label style={{ display: 'block', marginBottom: 6 }}>
          <div>Word Length Histogram Max Chars</div>
          <input type="number" min={5} max={30} value={asNumber('wordFrequency.lengthHistogramMaxChars')} onChange={(e) => onUpdate('wordFrequency.lengthHistogramMaxChars', Number(e.target.value))}
            style={{ width: 240, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
        </label>
      </section>

      {/* Word Search */}
      <section style={{ marginTop: 8, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 6, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Word Search</h3>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Default Targets</div>
          <textarea value={asString('wordSearch.defaultTargets')} onChange={(e) => onUpdate('wordSearch.defaultTargets', e.target.value)}
            style={{ width: '100%', height: 68, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Comma or newline separated words/phrases to scan for by default.</div>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Context Words</div>
            <input type="number" min={0} max={50} value={asNumber('wordSearch.contextWords')} onChange={(e) => onUpdate('wordSearch.contextWords', Number(e.target.value))}
              style={{ width: 140, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          </label>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Cluster Window</div>
            <input type="number" min={10} max={2000} value={asNumber('wordSearch.clusterWindow')} onChange={(e) => onUpdate('wordSearch.clusterWindow', Number(e.target.value))}
              style={{ width: 160, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          </label>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Min Cluster Size</div>
            <input type="number" min={2} max={50} value={asNumber('wordSearch.minClusterSize')} onChange={(e) => onUpdate('wordSearch.minClusterSize', Number(e.target.value))}
              style={{ width: 160, padding: '6px 8px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 4 }} />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordSearch.caseSensitive')} onChange={(e) => onUpdate('wordSearch.caseSensitive', e.target.checked)} /> Case Sensitive
          </label>
          <label style={{ display: 'block', marginBottom: 0 }}>
            <input type="checkbox" checked={asBoolean('wordSearch.enableAssistantExpansion')} onChange={(e) => onUpdate('wordSearch.enableAssistantExpansion', e.target.checked)} /> Enable Assistant Expansion
            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>Suggests synonyms/inflections using the configured dictionary model when enabled.</div>
          </label>
        </div>
      </section>

      <div style={{ opacity: 0.7, marginTop: 10 }}>Settings save automatically.</div>
    </div>
  );
};
