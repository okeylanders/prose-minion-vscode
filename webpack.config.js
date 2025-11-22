const path = require('path');

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
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@messages$': path.resolve(__dirname, 'src/shared/types/messages/index.ts'),
      '@messages': path.resolve(__dirname, 'src/shared/types/messages'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@handlers': path.resolve(__dirname, 'src/application/handlers'),
      '@services': path.resolve(__dirname, 'src/infrastructure/api/services'),
      '@standards': path.resolve(__dirname, 'src/infrastructure/standards'),
      '@secrets': path.resolve(__dirname, 'src/infrastructure/secrets')
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
              configFile: 'tsconfig.json'
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
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@messages$': path.resolve(__dirname, 'src/shared/types/messages/index.ts'),
      '@messages': path.resolve(__dirname, 'src/shared/types/messages'),
      '@components': path.resolve(__dirname, 'src/presentation/webview/components'),
      '@hooks': path.resolve(__dirname, 'src/presentation/webview/hooks'),
      '@utils': path.resolve(__dirname, 'src/presentation/webview/utils'),
      '@formatters': path.resolve(__dirname, 'src/presentation/webview/utils/formatters')
    }
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
              configFile: 'tsconfig.webview.json'
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
