const path = require('path');
const webpack = require('webpack');

// Read FIREBASE_API_KEY from the build environment.
// In CI / `npm run package`, set this in `.env.production` (gitignored)
// or as a literal environment variable.
const fs = require('fs');

let buildApiKey = process.env.FIREBASE_API_KEY || process.env.CLIENT_FIREBASE_API_KEY || '';

if (!buildApiKey) {
  const envPaths = [
    path.resolve(__dirname, '.env.production'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', '.env.production'),
    path.resolve(__dirname, '..', '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            let val = parts.slice(1).join('=').trim();
            // strip quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key === 'FIREBASE_API_KEY' || key === 'CLIENT_FIREBASE_API_KEY') {
              buildApiKey = val;
              break;
            }
          }
        }
        if (buildApiKey) break;
      } catch (err) {
        // ignore read errors
      }
    }
  }
}

const FIREBASE_API_KEY = buildApiKey;

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
