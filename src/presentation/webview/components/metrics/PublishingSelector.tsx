import * as React from 'react';
import { UsePublishingSettingsReturn } from '@hooks/domain/usePublishingSettings';

interface PublishingSelectorProps {
  publishingSettings: UsePublishingSettingsReturn;
  disabled?: boolean;
}

/**
 * PublishingSelector - shared UI for selecting publishing presets and trim sizes.
 * Extracted from MetricsTab to keep the orchestrator thin.
 */
export const PublishingSelector: React.FC<PublishingSelectorProps> = ({
  publishingSettings,
  disabled = false
}) => {
  const handlePresetChange = (value: string) => {
    publishingSettings.setPublishingPreset(value);
  };

  const handleTrimChange = (value: string) => {
    publishingSettings.setPublishingTrim(value);
  };

  const trimOptions = React.useMemo(() => {
    if (!publishingSettings.publishingPreset.startsWith('genre:')) return [];
    const genreKey = publishingSettings.publishingPreset.replace('genre:', '');
    return publishingSettings.publishingGenres.find((g: any) => g.key === genreKey)?.pageSizes || [];
  }, [publishingSettings.publishingGenres, publishingSettings.publishingPreset]);

  return (
    <div className="input-container">
      <label className="block text-sm font-medium mb-2 mt-3" htmlFor="pm-preset-select">
        Publishing Standards
      </label>
      <div className="flex gap-2 mb-2">
        <select
          id="pm-preset-select"
          className="w-1/2"
          value={publishingSettings.publishingPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          title="Select a genre preset or manuscript format to compare metrics against publishing ranges"
          disabled={disabled}
        >
          <option value="none">None</option>
          <option value="manuscript">Manuscript Format</option>
          <optgroup label="Genres">
            {publishingSettings.publishingGenres.map((g: any) => (
              <option key={g.key} value={`genre:${g.key}`}>
                {g.name} ({g.abbreviation})
              </option>
            ))}
          </optgroup>
        </select>
        <label
          className="block text-sm font-medium mb-2"
          htmlFor="pm-trim-select"
          style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
        >
          Trim Size
        </label>
        <select
          id="pm-trim-select"
          className="w-1/2"
          value={publishingSettings.publishingTrimKey}
          onChange={(e) => handleTrimChange(e.target.value)}
          title="Choose a trim size to estimate page count and words-per-page"
          disabled={disabled || !publishingSettings.publishingPreset.startsWith('genre:')}
        >
          <option value="">Auto (common size)</option>
          {trimOptions.map((ps: any) => (
            <option key={ps.key} value={ps.key}>
              {ps.label} ({ps.width}x{ps.height} in)
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
