/**
 * VsCodeSettingsStore - VS Code adapter for the `SettingsStore` port.
 *
 * Convention (ADR 2026-06-16):
 *   - Ports live in `src/platform/*.ts` (vscode-free → future `packages/core`).
 *   - Their VS Code adapters live in `src/platform/vscode/*.ts` (import vscode →
 *     future `apps/vscode-extension`).
 *
 * Delegates to `vscode.workspace.getConfiguration(section)`, called fresh on each
 * method so snapshot semantics match the prior inline calls. All updates use
 * `ConfigurationTarget.Global` (the only target this app writes).
 */
import * as vscode from 'vscode';
import { SettingsStore } from '../SettingsStore';

export class VsCodeSettingsStore implements SettingsStore {
  get<T>(section: string, key: string): T | undefined;
  get<T>(section: string, key: string, defaultValue: T): T;
  get<T>(section: string, key: string, defaultValue?: T): T | undefined {
    const config = vscode.workspace.getConfiguration(section);
    return defaultValue === undefined ? config.get<T>(key) : config.get<T>(key, defaultValue);
  }

  update(section: string, key: string, value: unknown): PromiseLike<void> {
    return Promise.resolve(
      vscode.workspace.getConfiguration(section).update(key, value, vscode.ConfigurationTarget.Global)
    );
  }
}
