module.exports = {
  content: [
    './src/presentation/webview/**/*.{ts,tsx,js,jsx}'
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
