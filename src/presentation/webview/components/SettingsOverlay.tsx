import * as React from 'react';
import { ModelScope, MessageType, ModelOption } from '../../../shared/types';

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
  onModelChange
}) => {
  if (!visible) return null;

  const get = (key: string) => settings[key];
  const asString = (key: string) => String(get(key) ?? '');
  const asNumber = (key: string) => Number(get(key) ?? 0);
  const asBoolean = (key: string) => Boolean(get(key));

  const renderModelSelect = (scope: ModelScope, label: string) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <select
        value={modelSelections[scope] || ''}
        onChange={(e) => onModelChange(scope, e.target.value)}
        style={{ width: '100%', padding: '6px 8px' }}
      >
        {modelOptions.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 'min(920px, 96vw)', maxHeight: '90vh', overflow: 'auto',
        background: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)',
        border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 8, padding: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Prose Minion Settings</h2>
          <button onClick={onClose} title="Close" style={{ padding: '4px 8px' }}>Close</button>
        </div>

        <p>Configure the extension without leaving this view. Learn more at <a href="https://openrouter.ai/" target="_blank" rel="noopener">OpenRouter</a>. Terms like “hapax” (frequency=1 words) and “lemmas” (base forms) are explained inline.</p>

        <section style={{ marginTop: 12 }}>
          <h3>Connection</h3>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>OpenRouter API Key</div>
            <input type="password" value={asString('openRouterApiKey')} onChange={(e) => onUpdate('openRouterApiKey', e.target.value)} style={{ width: '100%', padding: '6px 8px' }} />
          </label>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Models</h3>
          {renderModelSelect('assistant', 'Assistant Model (Prose / Dialogue)')}
          {renderModelSelect('dictionary', 'Dictionary Model')}
          {renderModelSelect('context', 'Context Assistant Model')}
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>General</h3>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" checked={asBoolean('includeCraftGuides')} onChange={(e) => onUpdate('includeCraftGuides', e.target.checked)} /> Include Craft Guides
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Temperature (0–2)</div>
            <input type="number" min={0} max={2} step={0.1} value={asNumber('temperature')} onChange={(e) => onUpdate('temperature', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Max Tokens (response length)</div>
            <input type="number" min={100} max={100000} step={100} value={asNumber('maxTokens')} onChange={(e) => onUpdate('maxTokens', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" checked={asBoolean('ui.showTokenWidget')} onChange={(e) => onUpdate('ui.showTokenWidget', e.target.checked)} /> Show Token Usage Widget
          </label>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Publishing Standards</h3>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Preset</div>
            <input type="text" value={asString('publishingStandards.preset')} onChange={(e) => onUpdate('publishingStandards.preset', e.target.value)} placeholder="none | manuscript | genre:<slug>" />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Trim Size Key</div>
            <input type="text" value={asString('publishingStandards.pageSizeKey')} onChange={(e) => onUpdate('publishingStandards.pageSizeKey', e.target.value)} placeholder="e.g., 6x9" />
          </label>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Word Frequency</h3>
          <p>Hapax = words that appear exactly once. Lemmas = base forms (e.g., “running” → “run”).</p>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Top N Words</div>
            <input type="number" min={10} max={1000} value={asNumber('wordFrequency.topN')} onChange={(e) => onUpdate('wordFrequency.topN', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.includeHapaxList')} onChange={(e) => onUpdate('wordFrequency.includeHapaxList', e.target.checked)} /> Include Hapax List
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div>Hapax Display Max</div>
            <input type="number" min={50} max={5000} value={asNumber('wordFrequency.hapaxDisplayMax')} onChange={(e) => onUpdate('wordFrequency.hapaxDisplayMax', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.includeStopwordsTable')} onChange={(e) => onUpdate('wordFrequency.includeStopwordsTable', e.target.checked)} /> Include Stopwords Table
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.contentWordsOnly')} onChange={(e) => onUpdate('wordFrequency.contentWordsOnly', e.target.checked)} /> Content Words Only
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.posEnabled')} onChange={(e) => onUpdate('wordFrequency.posEnabled', e.target.checked)} /> POS Tagger Enabled
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.includeBigrams')} onChange={(e) => onUpdate('wordFrequency.includeBigrams', e.target.checked)} /> Include Bigrams
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.includeTrigrams')} onChange={(e) => onUpdate('wordFrequency.includeTrigrams', e.target.checked)} /> Include Trigrams
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" checked={asBoolean('wordFrequency.enableLemmas')} onChange={(e) => onUpdate('wordFrequency.enableLemmas', e.target.checked)} /> Enable Lemmas (experimental)
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div>Word Length Histogram Max Chars</div>
            <input type="number" min={5} max={30} value={asNumber('wordFrequency.lengthHistogramMaxChars')} onChange={(e) => onUpdate('wordFrequency.lengthHistogramMaxChars', Number(e.target.value))} />
          </label>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Word Search</h3>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div>Default Targets (comma or newline separated)</div>
            <textarea value={asString('wordSearch.defaultTargets')} onChange={(e) => onUpdate('wordSearch.defaultTargets', e.target.value)} style={{ width: '100%', height: 60 }} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div>Context Words</div>
            <input type="number" min={0} max={50} value={asNumber('wordSearch.contextWords')} onChange={(e) => onUpdate('wordSearch.contextWords', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div>Cluster Window</div>
            <input type="number" min={10} max={2000} value={asNumber('wordSearch.clusterWindow')} onChange={(e) => onUpdate('wordSearch.clusterWindow', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <div>Min Cluster Size</div>
            <input type="number" min={2} max={50} value={asNumber('wordSearch.minClusterSize')} onChange={(e) => onUpdate('wordSearch.minClusterSize', Number(e.target.value))} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={asBoolean('wordSearch.caseSensitive')} onChange={(e) => onUpdate('wordSearch.caseSensitive', e.target.checked)} /> Case Sensitive
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" checked={asBoolean('wordSearch.enableAssistantExpansion')} onChange={(e) => onUpdate('wordSearch.enableAssistantExpansion', e.target.checked)} /> Enable Assistant Expansion
          </label>
        </section>

        <section style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
          <button onClick={onResetTokens} title="Reset session token totals">Reset Token Usage</button>
          <div style={{ opacity: 0.7 }}>Settings save automatically.</div>
        </section>
      </div>
    </div>
  );
};

