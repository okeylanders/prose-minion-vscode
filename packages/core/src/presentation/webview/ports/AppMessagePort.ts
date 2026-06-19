/**
 * AppMessagePort — the webview-side seam to the host (the renderer's lone
 * runtime touchpoint; the 8th port in the ports-and-adapters migration).
 *
 * This is the ONE port that lives in the webview tree rather than
 * `src/platform/`: the webview is a separate bundle (`tsconfig.webview.json`,
 * its own webpack entry) and cannot import host/platform code — so a port that
 * only webview code consumes belongs here, reached by relative import.
 *
 * In the VS Code webview the implementation is the `acquireVsCodeApi()` global,
 * isolated in `useVSCodeApi` (the VS Code adapter — the ONLY module that
 * references the global). In a future Electron renderer it will be an IPC /
 * contextBridge-backed object of the same shape. `getState`/`setState` are the
 * ephemeral webview-persistence API (survives an editor-tab reload, not a
 * session reset) — distinct from any extension-host state store.
 *
 * INBOUND (host -> webview) is intentionally NOT a method here: on every
 * platform core receives host messages via `window.addEventListener('message')`,
 * never through the port. So an adapter implements only these three methods.
 *
 * `VSCodeAPI` (presentation/webview/types/vscode.ts) is the VS Code webview's
 * ergonomically-typed view of this port (generic `postMessage<T>`, `any`
 * get/setState for consumer code); it `extends AppMessagePort`.
 */
export interface AppMessagePort {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}
