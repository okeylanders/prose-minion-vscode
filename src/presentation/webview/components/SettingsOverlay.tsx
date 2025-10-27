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

  const renderModelSelect = (scope: ModelScope, label: string, help?: string) => (
    <label className="settings-label">
      <div className="settings-label-title">{label}</div>
      <select
        value={modelSelections[scope] || ''}
        onChange={(e) => onModelChange(scope, e.target.value)}
        className="settings-input"
      >
        {modelOptions.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      {help && <div className="settings-description">{help}</div>}
    </label>
  );

  return (
    <div className="settings-overlay">
      <div className="settings-header">
        <h2>Settings</h2>
        <button onClick={onClose} title="Close" className="settings-button">Close</button>
      </div>

      {/* Connection */}
      <section className="settings-section">
        <h3 className="settings-section-title">Connection</h3>
        <label className="settings-label">
          <div className="settings-label-title">OpenRouter API Key</div>
          <input
            type="password"
            value={asString('openRouterApiKey')}
            onChange={(e) => onUpdate('openRouterApiKey', e.target.value)}
            className="settings-input"
          />
          <div className="settings-description">
            Requires an OpenRouter pay‑as‑you‑go account for AI features. OpenRouter routes to leading models with configurable privacy (no logging, no training). Learn more at <a href="https://openrouter.ai/" target="_blank" rel="noreferrer">openrouter.ai</a>.
          </div>
        </label>
      </section>

      {/* Models */}
      <section className="settings-section">
        <h3 className="settings-section-title">Models</h3>
        {renderModelSelect('assistant', 'Assistant Model (Prose / Dialogue)', 'Powers dialogue and prose assistants for analysis and creative suggestions.')}
        {renderModelSelect('dictionary', 'Dictionary Model', 'Powers dictionary and utility tools (synonyms, word expansions).')}
        {renderModelSelect('context', 'Context Assistant Model', 'Powers the context assistant for project-aware insights and resources.')}
      </section>

      {/* General */}
      <section className="settings-section">
        <h3 className="settings-section-title">General</h3>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('includeCraftGuides')}
            onChange={(e) => onUpdate('includeCraftGuides', e.target.checked)}
          /> Include Craft Guides
          <div className="settings-description">
            Adds writing guides and examples to prompts for richer, more context-aware suggestions. Uses more tokens but improves quality.
          </div>
        </label>

        <label className="settings-label">
          <div className="settings-label-title">Temperature (0–2)</div>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={asNumber('temperature')}
            onChange={(e) => onUpdate('temperature', Number(e.target.value))}
            className="settings-input settings-input-small"
          />
          <div className="settings-description">
            Controls creative diversity. Higher = more creative variety (1.2+), lower = more focused consistency (0.3). Default 0.7 is balanced.
          </div>
        </label>

        <label className="settings-label">
          <div className="settings-label-title">Max Tokens</div>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            value={asNumber('maxTokens')}
            onChange={(e) => onUpdate('maxTokens', Number(e.target.value))}
            className="settings-input settings-input-medium"
          />
          <div className="settings-description">
            Maximum length for AI responses. Truncation notices appear when this limit is reached.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('ui.showTokenWidget')}
            onChange={(e) => onUpdate('ui.showTokenWidget', e.target.checked)}
          /> Show Token Usage Widget
          <div className="settings-description">
            Displays running token totals in the header. Resets manually or on reload.
          </div>
        </label>

        <div style={{ marginTop: 8 }}>
          <button
            onClick={onResetTokens}
            title="Reset session token totals"
            className="settings-button"
          >
            Reset Token Usage
          </button>
        </div>
      </section>

      {/* Publishing Standards */}
      <section className="settings-section">
        <h3 className="settings-section-title">Publishing Standards</h3>

        <label className="settings-label">
          <div className="settings-label-title">Preset</div>
          <select
            value={publishing.preset}
            onChange={(e) => publishing.onPresetChange(e.target.value)}
            className="settings-input settings-input-large"
          >
            <option value="none">None</option>
            <option value="manuscript">Manuscript</option>
            {publishing.genres.map(g => (
              <option key={g.key} value={`genre:${g.key}`}>
                Genre: {g.name}{g.abbreviation ? ` (${g.abbreviation})` : ''}
              </option>
            ))}
          </select>
          <div className="settings-description">
            Choose a comparison standard for prose metrics: generic manuscript guidelines or specific genre expectations.
          </div>
        </label>

        <label className="settings-label">
          <div className="settings-label-title">Trim Size</div>
          <select
            value={publishing.trimKey}
            onChange={(e) => publishing.onTrimChange(e.target.value || undefined)}
            className="settings-input settings-input-large"
            style={{ maxWidth: 320 }}
          >
            <option value="">(Default)</option>
            {(publishing.genres.find(g => `genre:${g.key}` === publishing.preset)?.pageSizes || []).map(ps => (
              <option key={ps.key} value={ps.key}>{ps.label}</option>
            ))}
          </select>
          <div className="settings-description">
            If a genre is selected, choose a typical book trim size for more accurate page count comparisons.
          </div>
        </label>
      </section>

      {/* Word Frequency */}
      <section className="settings-section">
        <h3 className="settings-section-title">Word Frequency</h3>

        <label className="settings-label">
          <div className="settings-label-title">Top N Words</div>
          <input
            type="number"
            min={10}
            max={1000}
            value={asNumber('wordFrequency.topN')}
            onChange={(e) => onUpdate('wordFrequency.topN', Number(e.target.value))}
            className="settings-input settings-input-small"
          />
          <div className="settings-description">
            Number of most frequent words to display in the Top Words list.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.includeHapaxList')}
            onChange={(e) => onUpdate('wordFrequency.includeHapaxList', e.target.checked)}
          /> Include Hapax List
          <div className="settings-description">
            Hapax words appear exactly once in your text. Useful for spotting unique vocabulary, one-off expressions, or potential typos.
          </div>
        </label>

        <label className="settings-label">
          <div className="settings-label-title">Hapax Display Max</div>
          <input
            type="number"
            min={50}
            max={5000}
            value={asNumber('wordFrequency.hapaxDisplayMax')}
            onChange={(e) => onUpdate('wordFrequency.hapaxDisplayMax', Number(e.target.value))}
            className="settings-input settings-input-medium"
          />
          <div className="settings-description">
            Maximum number of hapax words to show in the list. Total count is always displayed.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.includeStopwordsTable')}
            onChange={(e) => onUpdate('wordFrequency.includeStopwordsTable', e.target.checked)}
          /> Include Stopwords Table
          <div className="settings-description">
            Shows common function words (the, and, of, to, in, etc.) for checking prose rhythm and balance.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.contentWordsOnly')}
            onChange={(e) => onUpdate('wordFrequency.contentWordsOnly', e.target.checked)}
          /> Content Words Only
          <div className="settings-description">
            Exclude stopwords (function words) to focus on meaningful content: nouns, verbs, adjectives, and adverbs.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.posEnabled')}
            onChange={(e) => onUpdate('wordFrequency.posEnabled', e.target.checked)}
          /> POS Tagger Enabled
          <div className="settings-description">
            Enables part-of-speech analysis (nouns, verbs, adjectives, etc.) using offline processing. Falls back gracefully if unavailable.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.includeBigrams')}
            onChange={(e) => onUpdate('wordFrequency.includeBigrams', e.target.checked)}
          /> Include Bigrams
          <div className="settings-description">
            Shows top two-word phrases (e.g., "dark night", "she said", "front door"). Helpful for spotting recurring collocations and clichés.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.includeTrigrams')}
            onChange={(e) => onUpdate('wordFrequency.includeTrigrams', e.target.checked)}
          /> Include Trigrams
          <div className="settings-description">
            Shows top three-word phrases (e.g., "out of the", "end of the", "looked at her"). Useful for identifying set-piece phrasings and voice patterns.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordFrequency.enableLemmas')}
            onChange={(e) => onUpdate('wordFrequency.enableLemmas', e.target.checked)}
          /> Enable Lemmas (experimental)
          <div className="settings-description">
            Groups inflected word forms under their base form (e.g., "running", "ran", "runs" → "run"). Helps identify word variety.
          </div>
        </label>

        <label className="settings-label">
          <div className="settings-label-title">Word Length Histogram Max Chars</div>
          <input
            type="number"
            min={5}
            max={30}
            value={asNumber('wordFrequency.lengthHistogramMaxChars')}
            onChange={(e) => onUpdate('wordFrequency.lengthHistogramMaxChars', Number(e.target.value))}
            className="settings-input settings-input-medium"
          />
          <div className="settings-description">
            Maximum word length shown in the histogram. Words longer than this are grouped into a final "N+" bucket.
          </div>
        </label>
      </section>

      {/* Word Search */}
      <section className="settings-section">
        <h3 className="settings-section-title">Word Search</h3>

        <label className="settings-label">
          <div className="settings-label-title">Default Targets</div>
          <textarea
            value={asString('wordSearch.defaultTargets')}
            onChange={(e) => onUpdate('wordSearch.defaultTargets', e.target.value)}
            className="settings-textarea"
          />
          <div className="settings-description">
            Default words or phrases to search for (comma or newline separated). These auto-populate the search field.
          </div>
        </label>

        <div className="settings-inline-group">
          <label className="settings-label">
            <div className="settings-label-title">Context Words</div>
            <input
              type="number"
              min={0}
              max={50}
              value={asNumber('wordSearch.contextWords')}
              onChange={(e) => onUpdate('wordSearch.contextWords', Number(e.target.value))}
              className="settings-input settings-input-small"
            />
            <div className="settings-description">
              Number of words shown before and after each match for context.
            </div>
          </label>

          <label className="settings-label">
            <div className="settings-label-title">Cluster Window</div>
            <input
              type="number"
              min={10}
              max={2000}
              value={asNumber('wordSearch.clusterWindow')}
              onChange={(e) => onUpdate('wordSearch.clusterWindow', Number(e.target.value))}
              className="settings-input settings-input-small"
            />
            <div className="settings-description">
              Word distance within which matches are grouped as a cluster. Smaller values find tighter clusters.
            </div>
          </label>

          <label className="settings-label">
            <div className="settings-label-title">Min Cluster Size</div>
            <input
              type="number"
              min={2}
              max={50}
              value={asNumber('wordSearch.minClusterSize')}
              onChange={(e) => onUpdate('wordSearch.minClusterSize', Number(e.target.value))}
              className="settings-input settings-input-small"
            />
            <div className="settings-description">
              Minimum matches within the cluster window to report a cluster. Set to 2 to see any repeated pattern.
            </div>
          </label>
        </div>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordSearch.caseSensitive')}
            onChange={(e) => onUpdate('wordSearch.caseSensitive', e.target.checked)}
          /> Case Sensitive
          <div className="settings-description">
            When enabled, "Rose" and "rose" are treated as different words.
          </div>
        </label>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={asBoolean('wordSearch.enableAssistantExpansion')}
            onChange={(e) => onUpdate('wordSearch.enableAssistantExpansion', e.target.checked)}
          /> Enable Assistant Expansion
          <div className="settings-description">
            Uses the dictionary model to suggest synonyms and inflections when enabled. (Coming soon)
          </div>
        </label>
      </section>

      <div className="settings-footer-note">Settings save automatically.</div>
    </div>
  );
};
