/**
 * useWorkshopExcerptVerify — the Workshop panel's paste-to-selection
 * verification lane (Sprint 12), mirroring the sidebar's proven
 * `assistant_excerpt_verify` seam behind the panel's own typed target.
 *
 * On paste, the panel stashes the pasted text here and asks the host for the
 * active editor selection. Provenance is stamped ONLY when the selection
 * matches the pasted text exactly; anything else stays honestly manual. The
 * verified text rides with the source so consumers can gate on
 * `draft === verified.text` — edit the draft after pasting and the claim
 * simply stops applying, no cleanup effects required.
 *
 * Ephemeral by design: verification claims never persist across reloads.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  MessageType,
  SelectionDataMessage,
  WorkshopExcerptSource
} from '@messages';

export interface WorkshopVerifiedExcerpt {
  /** The exact text the claim covers — gate provenance on strict equality. */
  text: string;
  source: WorkshopExcerptSource;
}

export interface WorkshopExcerptVerifyState {
  verified: WorkshopVerifiedExcerpt | null;
}

export interface WorkshopExcerptVerifyActions {
  /** Stash pasted text and ask the host for the active selection. */
  requestVerify: (pastedText: string) => void;
  /** Route target: SELECTION_DATA for `workshop_excerpt_verify` only. */
  handleSelectionData: (message: SelectionDataMessage) => void;
  clearVerified: () => void;
}

export type UseWorkshopExcerptVerifyReturn =
  WorkshopExcerptVerifyState & WorkshopExcerptVerifyActions;

export const useWorkshopExcerptVerify = (): UseWorkshopExcerptVerifyReturn => {
  const vscode = useVSCodeApi();
  const [verified, setVerified] = React.useState<WorkshopVerifiedExcerpt | null>(null);
  const pendingVerifyTextRef = React.useRef<string | null>(null);

  const requestVerify = React.useCallback(
    (pastedText: string) => {
      pendingVerifyTextRef.current = pastedText;
      vscode.postMessage({
        type: MessageType.REQUEST_SELECTION,
        source: 'webview.workshop.excerpt',
        payload: { target: 'workshop_excerpt_verify' },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  const handleSelectionData = React.useCallback((message: SelectionDataMessage) => {
    const { target, content, sourceUri, relativePath, startLine, endLine } = message.payload;
    if (target !== 'workshop_excerpt_verify') {
      return;
    }
    const pending = pendingVerifyTextRef.current;
    pendingVerifyTextRef.current = null;
    if (pending && content === pending && sourceUri && relativePath) {
      setVerified({
        text: pending,
        source: { kind: 'editor-selection', sourceUri, relativePath, startLine, endLine }
      });
    } else {
      setVerified(null);
    }
  }, []);

  const clearVerified = React.useCallback(() => {
    pendingVerifyTextRef.current = null;
    setVerified(null);
  }, []);

  return { verified, requestVerify, handleSelectionData, clearVerified };
};
