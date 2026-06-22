const path = require('path');
const webpack = require('webpack');

// Read FIREBASE_API_KEY from the build environment.
// In CI / `npm run package`, set this in `.env.production` (gitignored)
// or as a literal environment variable.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';

if (!FIREBASE_API_KEY) {
  console.warn(
    '[ContextLens] WARNING: FIREBASE_API_KEY is not set. The bundled extension will throw on sign-in. ' +
    'Set FIREBASE_API_KEY in your environment or .env.production before running `npm run package`.'
  );
}

module.exports = {
  mode: 'none',
  target: 'node',
  entry: {
    extension: './src/extension.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs'
  },
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      __FIREBASE_API_KEY__: JSON.stringify(FIREBASE_API_KEY),
    }),
  ],
  externals: {
    vscode: 'commonjs vscode'
  },
  devtool: 'nosources-source-map',
};
