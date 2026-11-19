/**
 * The `history` manifest row and the boundary it rests on (ADR 2026-11-19
 * D15, D16): the row reads in, counts under "requested" as "File history",
 * logs by kind alone, and the extension still declares no support for
 * untrusted workspaces. Made-up *Alice* labels.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ContextSourceEntry } from '@shared/types';
import { contextSourcesCommitLogLine } from '@orchestration/ContextSourceRecord';
import { buildWorkshopContextBreakdown } from '@/application/services/workshop/WorkshopContextBreakdown';
import { isReadInSource, readInOpenAction } from '@utils/workshop/contextSources';

const row: ContextSourceEntry = {
  kind: 'history',
  origin: 'host',
  label: 'Drafts/6.11.md · 3f9a1c2b7e → current',
  sizeChars: 900,
  isEstimate: true,
  deliveredAt: 1,
  turnId: 'turn-4-assistant-1'
};

describe('the history row', () => {
  it('is read-in material that jumps to the card that fetched it', () => {
    expect(isReadInSource(row)).toBe(true);
    expect(readInOpenAction(row)).toEqual({ kind: 'jump', turnId: row.turnId });
  });

  it('counts under "requested" as File history, with no new tally piece', () => {
    const breakdown = buildWorkshopContextBreakdown({ systemTokens: 10, messageCount: 0, tally: [] }, [row]);
    const requested = breakdown.parts.find((part) => part.part === 'requested')!;
    expect(requested.pieces).toEqual([{ name: 'File history (1)', tokens: expect.any(Number) }]);
  });

  it('is logged by its kind alone, never its file or commits (D17)', () => {
    const line = contextSourcesCommitLogLine('conversation-1', [{ ...row }]);
    expect(line).toContain('history:(a file history diff)');
    expect(line).not.toContain('Drafts');
    expect(line).not.toContain('3f9a1c2b7e');
  });
});

describe('workspace trust is the boundary (D16)', () => {
  it('declares no support for untrusted workspaces, so neither Prose Minion nor the Git extension runs in Restricted Mode', () => {
    // A repository's config can make git run commands (a textconv inside `git show`, for one).
    // Keep this false or absent; changing it needs a decision of its own.
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../../../../apps/vscode-extension/package.json'), 'utf8')) as {
      capabilities?: { untrustedWorkspaces?: { supported?: unknown } };
      extensionDependencies?: string[];
    };
    const supported = manifest.capabilities?.untrustedWorkspaces?.supported;
    expect(supported === undefined || supported === false).toBe(true);
    // No extensionDependencies on vscode.git: a disabled Git extension must not stop Prose Minion activating (D12).
    expect(manifest.extensionDependencies ?? []).not.toContain('vscode.git');
  });
});
