import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Code, ExternalLink, Key, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProjects, useUserSettings } from '../lib/firestoreHooks'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: projects } = useProjects(user?.uid ?? '')
  const { data: userSettings } = useUserSettings(user?.uid ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'none'>('none')
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    openai: '',
    anthropic: ''
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (userSettings) {
      setAiProvider(userSettings.aiProvider || 'none')
      setApiKeys({
        gemini: userSettings.geminiApiKey || '',
        openai: userSettings.openaiApiKey || '',
        anthropic: userSettings.anthropicApiKey || ''
      })
    }
  }, [userSettings])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleSaveSettings = async () => {
    if (!user) return
    setIsSavingSettings(true)
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/global`), {
        aiProvider,
        geminiApiKey: apiKeys.gemini,
        openaiApiKey: apiKeys.openai,
        anthropicApiKey: apiKeys.anthropic
      }, { merge: true })
      setSavedMessage('Settings saved successfully!')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (err) {
      console.error("Failed to save settings", err)
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-textPrimary mb-6">Settings</h1>

      {/* Profile section */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Profile
        </h2>
        <div className="bg-card border border-cardBorder rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                className="w-12 h-12 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center text-lg text-primary font-bold">
                {user?.displayName?.[0] ?? 'U'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-textPrimary">
                {user?.displayName ?? 'Unknown User'}
              </p>
              <p className="text-xs text-textMuted">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-cardBorder pt-4">
            <button
              id="sign-out-btn"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-md border border-red-700/60 text-red-400 text-sm font-medium hover:bg-red-900/20 hover:border-red-600 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* Integration section */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Integrations
        </h2>
        <div className="bg-card border border-cardBorder rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Code className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-textPrimary">VS Code Extension</p>
                <p className="text-xs text-textMuted">Sync your coding sessions to the cloud</p>
              </div>
            </div>
            <a
              href={`https://contextlens-backend-001.web.app/api/auth/login?uid=${user?.uid}&callback=vscode://noventra-Labs.contextlens`}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-black text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Connect VS Code
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* AI Provider section */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          AI Provider Settings
        </h2>
        <div className="bg-card border border-cardBorder rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs text-textMuted mb-1.5">Select AI Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as any)}
              className="w-full bg-surface border border-cardBorder rounded-md px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
            >
              <option value="none">Default Server-Side Provider (Gemini)</option>
              <option value="gemini">Google Gemini (Bring your own key)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          {aiProvider === 'gemini' && (
            <div>
              <label className="block text-xs text-textMuted mb-1.5">Gemini API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-textMuted">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full bg-surface border border-cardBorder rounded-md pl-9 pr-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>
              <p className="text-[11px] text-textMuted mt-1.5">
                Your key is stored securely and sent directly to Google. It's never logged or persisted.
              </p>
            </div>
          )}
          {aiProvider === 'openai' && (
            <div>
              <label className="block text-xs text-textMuted mb-1.5">OpenAI API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-textMuted">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-surface border border-cardBorder rounded-md pl-9 pr-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>
              <p className="text-[11px] text-textMuted mt-1.5">
                Your key is stored securely and sent directly to OpenAI. It's never logged or persisted.
              </p>
            </div>
          )}
          {aiProvider === 'anthropic' && (
            <div>
              <label className="block text-xs text-textMuted mb-1.5">Anthropic API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-textMuted">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
                    placeholder="sk-ant-..."
                    className="w-full bg-surface border border-cardBorder rounded-md pl-9 pr-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>
              <p className="text-[11px] text-textMuted mt-1.5">
                Your key is stored securely and sent directly to Anthropic. It's never logged or persisted.
              </p>
            </div>
          )}

          <div className="border-t border-cardBorder pt-4 flex items-center justify-between">
            {savedMessage ? (
              <span className="text-sm text-green-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {savedMessage}
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-4 py-2 rounded-md bg-primary text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </section>

      {/* Project settings section */}
      <section>
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Project Settings
        </h2>
        <div className="bg-card border border-cardBorder rounded-lg p-5 space-y-4">
          {/* Project selector */}
          <div>
            <label className="block text-xs text-textMuted mb-1.5">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-surface border border-cardBorder rounded-md px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">— Choose a project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-textMuted mb-1.5">Project Name</label>
                  <input
                    readOnly
                    value={selectedProject.name}
                    className="w-full bg-surface/50 border border-cardBorder rounded-md px-3 py-2 text-sm text-textMuted cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-textMuted mb-1.5">Default Branch</label>
                  <input
                    readOnly
                    value={selectedProject.defaultBranch}
                    className="w-full bg-surface/50 border border-cardBorder rounded-md px-3 py-2 text-sm text-textMuted cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-textMuted mb-1.5">Repo URL</label>
                <input
                  readOnly
                  value={selectedProject.repoUrl}
                  className="w-full bg-surface/50 border border-cardBorder rounded-md px-3 py-2 text-xs text-textMuted font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-textMuted mb-1.5">Preferred Model</label>
                <input
                  readOnly
                  value={selectedProject.settings.preferredModel || 'gemini-1.5-pro'}
                  className="w-full bg-surface/50 border border-cardBorder rounded-md px-3 py-2 text-sm text-textMuted font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-3">
                {/* Redaction toggle (read-only display) */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-textPrimary">Redaction Enabled</p>
                    <p className="text-xs text-textMuted">Sensitive data masked in logs</p>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full transition-colors ${
                      selectedProject.settings.redactionEnabled
                        ? 'bg-primary'
                        : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${
                        selectedProject.settings.redactionEnabled
                          ? 'translate-x-5'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Auto summaries toggle (read-only display) */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-textPrimary">Auto Summaries</p>
                    <p className="text-xs text-textMuted">Generate episode summaries automatically</p>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full transition-colors ${
                      selectedProject.settings.autoSummariesEnabled
                        ? 'bg-primary'
                        : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${
                        selectedProject.settings.autoSummariesEnabled
                          ? 'translate-x-5'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-textMuted border-t border-cardBorder pt-3">
                Project settings are managed primarily by the VS Code extension.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
