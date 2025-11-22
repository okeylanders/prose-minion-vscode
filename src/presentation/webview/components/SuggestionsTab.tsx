/**
 * SuggestionsTab component - Presentation layer
 * Placeholder for future suggestion features
 */

import * as React from 'react';
import { VSCodeAPI } from '../types/vscode';

interface SuggestionsTabProps {
  selectedText: string;
  vscode: VSCodeAPI;
}

export const SuggestionsTab: React.FC<SuggestionsTabProps> = ({ selectedText, vscode }) => {
  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Writing Suggestions</h2>

      <div className="placeholder-content">
        <p className="text-gray-500">
          This tab will contain AI-powered writing suggestions and improvements.
        </p>
        <p className="text-gray-500 mt-2">
          Coming soon!
        </p>
      </div>
    </div>
  );
};
