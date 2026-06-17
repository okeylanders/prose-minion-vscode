const path = require('path');

module.exports = {
  // Absolute (root-anchored via __dirname) so content scanning is correct
  // regardless of cwd: the webview build runs from apps/vscode-extension, but the
  // webview source lives in packages/core. A cwd-relative glob (e.g. './packages/
  // core/...') silently matches NOTHING from the app dir, so Tailwind purges every
  // utility (w-full/h-32/etc.) and the layout breaks. Mirrors FrameMinion.
  content: [
    path.join(__dirname, 'packages/core/src/presentation/webview/**/*.{ts,tsx,js,jsx}')
  ],
  theme: {
    extend: {
      colors: {
        'vscode-foreground': 'var(--vscode-foreground)',
        'vscode-background': 'var(--vscode-editor-background)',
        'vscode-button': 'var(--vscode-button-background)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-input-background': 'var(--vscode-input-background)',
        'vscode-input-border': 'var(--vscode-input-border)',
      }
    }
  },
  plugins: []
};
