export interface Project {
  id: string
  name: string
  repoUrl: string
  localWorkspaceName: string
  defaultBranch: string
  createdAt: Date
  updatedAt: Date
  settings: {
    preferredModel: string
    redactionEnabled: boolean
    autoSummariesEnabled: boolean
  }
}

export interface UserSettings {
  id?: string
  aiProvider: 'gemini' | 'openai' | 'anthropic' | 'none'
  geminiApiKey?: string
  openaiApiKey?: string
  anthropicApiKey?: string
}

export interface Episode {
  id: string
  projectId: string
  label: string
  branchName: string
  status: 'active' | 'closed'
  startedAt: Date
  endedAt: Date | null
  callCount: number
  changedFiles: string[]
  latestDiffHash: string
  manualNotes: string
  episodeSummary: string | null
  explainDiffSummary: string | null
  explainDiffRisks: string[]
  explainDiffChecks: string[]
}

export interface Call {
  id: string
  episodeId: string
  createdAt: Date
  source: 'extension_chat' | 'manual_log'
  intentTag: string
  promptText: string
  modelName: string
  modelResponse: string
  branchName: string
  activeFilePath: string
  relatedFiles: string[]
  diffSnapshot: string
  diffHash: string
  todoMatches: string[]
  latencyMs: number
  tokenUsage: { input: number; output: number }
  status: 'success' | 'failed' | 'redacted'
}

export interface ExplainDiffResult {
  summary: string
  risks: string[]
  checks: string[]
}

export interface BranchSummaryResult {
  pr_summary: string
  key_changes: string[]
  review_risks: string[]
}
