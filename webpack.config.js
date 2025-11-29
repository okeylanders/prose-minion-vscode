const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

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
    plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.json' })],
    alias: {
      '@orchestration': path.resolve(__dirname, 'src/infrastructure/api/orchestration'),
      '@parsers': path.resolve(__dirname, 'src/infrastructure/api/parsers'),
      '@providers': path.resolve(__dirname, 'src/infrastructure/api/providers'),
      '@services': path.resolve(__dirname, 'src/infrastructure/api/services'),
      '@handlers': path.resolve(__dirname, 'src/application/handlers'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@messages': path.resolve(__dirname, 'src/shared/types/messages'),
      '@': path.resolve(__dirname, 'src')
    }
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
              configFile: 'tsconfig.json',
              transpileOnly: true,
              context: __dirname
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
  entry: './src/presentation/webview/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.webview.json' })]
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
              configFile: 'tsconfig.webview.json',
              transpileOnly: true,
              context: __dirname
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
                plugins: [
                  require('tailwindcss'),
                  require('autoprefixer')
                ]
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

module.exports = [extensionConfig, webviewConfig];
