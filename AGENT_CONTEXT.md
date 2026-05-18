# 專案上下文 (Agent Context)：ContextLens

> **最後更新時間**：2026-05-19 02:40
> **自動生成**：由 `prepare_context.py` 產生，供 AI Agent 快速掌握專案全局

---

## 🎯 1. 專案目標 (Project Goal)
* **核心目的**：> **Bridging the gap between code and context.**
* _完整說明見 [README.md](README.md)_

## 🛠️ 2. 技術棧與環境 (Tech Stack & Environment)
* **核心套件**：@anthropic-ai/sdk, @google-cloud/vertexai, @google/generative-ai, @sentry/google-cloud-serverless, @sentry/node, @sentry/profiling-node, body-parser, cors, dotenv, express
* **開發套件**：@types/jest, jest, nodemon
* **可用指令**：start, dev, test, test:watch, test:coverage

### 原始設定檔

<details><summary>package.json</summary>

```json
{
  "name": "contextlens-backend",
  "version": "0.1.0",
  "private": true,
  "description": "The backend and monorepo root for ContextLens - AI-driven coding context and insights.",
  "author": "89Aman",
  "keywords": [
    "ai",
    "context",
    "developer-tools",
    "vscode-extension",
    "gemini",
    "coding-insights"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/89Aman/Contextlens.git"
  },
  "bugs": {
    "url": "https://github.com/89Aman/Contextlens/issues"
  },
  "homepage": "https://github.com/89Aman/Contextlens#readme",
  "license": "MIT",
  "main": "src/index.js",
  "engines": {
    "node": "22"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.96.0",
    "@google-cloud/vertexai": "^1.12.0",
    "@google/generative-ai": "^0.24.1",
    "@sentry/google-cloud-serverless": "^10.53.1",
    "@sentry/node": "^10.53.1",
    "@sentry/profiling-node": "^10.53.1",
    "body-parser": "^2.2.2",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-rate-limit": "^8.5.2",
    "express-validator": "^7.3.2",
    "firebase-admin": "^13.9.0",
    "firebase-functions": "^7.2.5",
    "helmet": "^8.1.0",
    "morgan": "^1.10.1",
    "openai": "^6.38.0",
    "uuid": "^14.0.0"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "jest": "^30.4.2",
    "nodemon": "^3.1.14"
  }
}

```
</details>

## 📂 3. 核心目錄結構 (Core Structure)
_(💡 AI 讀取守則：請依據此結構尋找對應檔案，勿盲目猜測路徑)_
```text
ContextLens/
├── AGENT_CONTEXT.md
├── ContextLens.code-workspace
├── LICENSE
├── README.md
├── boost_commits.ps1
├── cli
│   ├── README.md
│   ├── index.js
│   └── package.json
├── contextlens-dashboard
│   ├── README.md
│   ├── index.html
│   ├── jest.config.js
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── public
│   │   └── favicon.svg
│   ├── src
│   │   ├── __tests__
│   │   ├── components
│   │   ├── context
│   │   ├── hooks
│   │   ├── index.css
│   │   ├── lib
│   │   ├── main.tsx
│   │   ├── pages
│   │   ├── routes
│   │   ├── setupTests.ts
│   │   └── types
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   ├── tsconfig.app.tsbuildinfo
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tsconfig.node.tsbuildinfo
│   └── vite.config.ts
├── diary
│   └── 2026
│       └── 05
├── docs
│   ├── ARCHITECTURE.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── CONTRIBUTIONS_TRACKER.md
│   ├── ContextLens_Build_Spec.txt
│   ├── DEVELOPMENT_LOG.md
│   ├── DOCUMENTATION.md
│   ├── SECURITY.md
│   ├── VERSIONS_AND_FIXES.md
│   ├── WORKFLOW_AND_PROCESSES.md
│   ├── backend-prod-readiness-audit.md
│   └── owasp-top-10-analysis.md
├── firebase.json
├── firestore.rules
├── jest.config.js
├── package-lock.json
├── package.json
├── src
│   ├── __tests__
│   │   ├── lib
│   │   └── middleware
│   ├── firebase.js
│   ├── index.js
│   ├── lib
│   │   ├── crypto.js
│   │   ├── envCheck.js
│   │   ├── errors.js
│   │   └── redaction.js
│   ├── middleware
│   │   ├── auditLog.js
│   │   ├── auth.js
│   │   ├── rateLimiter.js
│   │   ├── requestId.js
│   │   └── validate.js
│   ├── prompts.js
│   ├── routes
│   │   └── api.js
│   ├── sentry.js
│   └── services
│       └── ai.js
└── vscode-extension
    ├── LICENSE.txt
    ├── README.md
    ├── package-lock.json
    ├── package.json
    ├── src
    │   ├── apiClient.ts
    │   ├── auth.ts
    │   ├── chatViewProvider.ts
    │   ├── episodeStore.ts
    │   ├── extension.ts
    │   ├── gitContext.ts
    │   ├── redaction.ts
    │   ├── stateTreeProvider.ts
    │   ├── statusBar.ts
    │   ├── syncEngine.ts
    │   ├── telemetry.ts
    │   └── watchers.ts
    ├── tsconfig.json
    └── webpack.config.js
```

## 🏛️ 4. 架構與設計約定 (Architecture & Conventions)
* _（尚無 `.auto-skill-local.md`，專案踩坑經驗將在開發過程中自動累積）_

## 🚦 5. 目前進度與待辦 (Current Status & TODO)
_(自動提取自最近日記 2026-05-19)_

### 🚧 待辦事項
- [ ] Verify end-to-end AI calls with encrypted keys on staging/production environment.
- [ ] Test VS Code extension offline key retrieval from SecretStorage.

