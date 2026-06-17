const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

// Shared @prose-minion/core lives one level up in the monorepo. Module resolution for
// every `@`-alias (incl. `@prose-minion/core` itself) is DERIVED from the single
// source-of-truth path table in tsconfig.base.json via TsconfigPathsPlugin — no
// hand-mirrored alias list to drift. Because the plugin maps to core's TS *source*
// (not the node_modules workspace symlink), ts-loader — which excludes /node_modules/ —
// transpiles core as first-party.
const CORE_SRC = path.resolve(__dirname, '../../packages/core/src');
const BASE_TSCONFIG = path.resolve(__dirname, '../../tsconfig.base.json');

const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: BASE_TSCONFIG })]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // App host config; extends ../../tsconfig.base.json. Compiles the
              // shell + transitive core under commonjs/node (same as the pre-move host build).
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              transpileOnly: true
            }
          }
        ]
      }
    ]
  }
};

const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: path.resolve(CORE_SRC, 'presentation/webview/index.tsx'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: BASE_TSCONFIG })]
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, '../../packages/core/tsconfig.webview.json'),
              transpileOnly: true
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [require('tailwindcss'), require('autoprefixer')]
              }
            }
          }
        ]
      },
      {
        test: /\.svg$/i,
        type: 'asset/inline'
      }
    ]
  }
};

module.exports = (env, argv) => {
  if (argv && argv.mode === 'production') {
    // Production source maps are generated then stripped by .vscodeignore's
    // `**/*.map` (PR #60 review #11) — skip them for the prepublish/package build.
    // The dev/watch build (`--mode development`) keeps `devtool: 'source-map'` so
    // breakpoints bind under F5.
    extensionConfig.devtool = false;
    webviewConfig.devtool = false;
  }
  return [extensionConfig, webviewConfig];
};
