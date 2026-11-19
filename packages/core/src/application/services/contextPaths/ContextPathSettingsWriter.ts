/**
 * The context-path settings as one group reads and writes them (ADR
 * 2026-11-19 D24, D25): the live value, where it comes from, and the one
 * write, at the user level (L1), the patterns joined with `,`.
 *
 * The only code of this feature that writes a setting. The helper never
 * does (ADR 2026-11-05 D2), and nothing calls `write` except Apply.
 */

import type { SettingsStore } from '@/platform';
import type { ContextPathGroup, ContextPathSettingLevel } from '@shared/types';

const SECTION = 'proseMinion';

export interface ContextPathSettingRead {
  /** The value as stored, `''` when unset. Apply compares it with the value the view was made from. */
  readonly value: string;
  readonly level: ContextPathSettingLevel;
}

export class ContextPathSettingsWriter {
  constructor(private readonly settings: Pick<SettingsStore, 'get' | 'update' | 'levelOf'>) {}

  read(group: ContextPathGroup): ContextPathSettingRead {
    const key = `contextPaths.${group}`;
    const value = this.settings.get<string>(SECTION, key);
    return { value: typeof value === 'string' ? value : '', level: this.settings.levelOf(SECTION, key) };
  }

  async write(group: ContextPathGroup, patterns: readonly string[]): Promise<void> {
    await this.settings.update(SECTION, `contextPaths.${group}`, patterns.join(','));
  }
}
