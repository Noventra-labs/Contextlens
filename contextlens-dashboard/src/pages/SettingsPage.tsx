import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Code, ExternalLink, Key, Check, Loader2, Shield, Sparkles, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProjects, useUserSettings } from '../lib/firestoreHooks'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'none'

const PROVIDER_META: Record<AiProvider, { label: string; placeholder: string; hint: string }> = {
  none: { label: 'Default (Gemini)', placeholder: '', hint: '' },
  gemini: { label: 'Google Gemini', placeholder: 'AIzaSy...', hint: 'Sent directly to Google — never logged.' },
  openai: { label: 'OpenAI', placeholder: 'sk-...', hint: 'Sent directly to OpenAI — never logged.' },
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...', hint: 'Sent directly to Anthropic — never logged.' },
}

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: projects } = useProjects(user?.uid ?? '')
  const { data: userSettings } = useUserSettings(user?.uid ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const [aiProvider, setAiProvider] = useState<AiProvider>('none')
  const [apiKeys, setApiKeys] = useState({ gemini: '', openai: '', anthropic: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (userSettings) {
      setAiProvider(userSettings.aiProvider || 'none')
      setApiKeys({
        gemini: userSettings.geminiApiKey || '',
        openai: userSettings.openaiApiKey || '',
        anthropic: userSettings.anthropicApiKey || '',
      })
    }
  }, [userSettings])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [signOut, navigate])

  const handleSave = useCallback(async () => {
    if (!user) return
    setIsSaving(true)
    setSaveState('idle')
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/global`), {
        aiProvider,
        geminiApiKey: apiKeys.gemini,
        openaiApiKey: apiKeys.openai,
        anthropicApiKey: apiKeys.anthropic,
      }, { merge: true })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (err) {
      console.error('Failed to save settings', err)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 4000)
    } finally {
      setIsSaving(false)
    }
  }, [user, aiProvider, apiKeys])

  const [copiedToken, setCopiedToken] = useState(false)

  const handleCopyCliToken = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      await navigator.clipboard.writeText(token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    } catch (err) {
      console.error('Failed to copy token', err)
    }
  }, [user])

  const showKeyInput = aiProvider !== 'none'
  const meta = PROVIDER_META[aiProvider]

  return (
    <div className="max-w-2xl page-enter space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-textPrimary">Settings</h1>
        </div>
        <p className="text-xs text-textMuted">
          Manage your credentials, VS Code integrations, and project preferences.
        </p>
      </div>

      {/* ── Profile ──────────────────────────────────────────────────── */}
      <section className="animate-fadeIn" style={{ animationDelay: '40ms' }}>
        <SectionLabel icon={<User className="w-3.5 h-3.5" />}>Profile</SectionLabel>
        <div className="bg-card border border-cardBorder rounded-xl p-6 space-y-5 card-glow transition-all duration-200">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                className="w-12 h-12 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-surface"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center text-lg text-primary font-bold ring-2 ring-primary/20 ring-offset-2 ring-offset-surface">
                {user?.displayName?.[0] ?? 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-textPrimary truncate">
                {user?.displayName ?? 'Unknown User'}
              </p>
              <p className="text-xs text-textMuted truncate">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-cardBorder/60 pt-4 flex justify-end">
            <button
              id="sign-out-btn"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/20 text-red-400 text-sm font-medium
                         hover:bg-red-500/10 hover:border-red-500/40 active:scale-[0.98]
                         transition-all duration-150 ease-out"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────── */}
      <section className="animate-fadeIn" style={{ animationDelay: '80ms' }}>
        <SectionLabel icon={<Code className="w-3.5 h-3.5" />}>Integrations</SectionLabel>
        <div className="space-y-4">
          <div className="bg-card border border-cardBorder rounded-xl p-6 card-glow transition-all duration-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary flex-shrink-0 border border-primary/10">
                  <Code className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-textPrimary">VS Code Extension</p>
                  <p className="text-xs text-textMuted truncate">Sync coding sessions to the cloud</p>
                </div>
              </div>
              <a
                href={`https://contextlens-backend-001.web.app/api/auth/login?uid=${user?.uid}&callback=vscode://Noventra-Labs.contextlens`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold
                           hover:brightness-110 active:scale-[0.97]
                           transition-all duration-150 ease-out flex-shrink-0 shadow-lg shadow-primary/10"
              >
                Connect
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-card border border-cardBorder rounded-xl p-6 card-glow transition-all duration-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary flex-shrink-0 border border-primary/10">
                  <Key className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-textPrimary">CLI Tool (cl)</p>
                  <p className="text-xs text-textMuted truncate">Copy authentication token for the CLI</p>
                </div>
              </div>
              <button
                id="copy-cli-token-btn"
                onClick={handleCopyCliToken}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold
                           hover:brightness-110 active:scale-[0.97]
                           transition-all duration-150 ease-out flex-shrink-0 shadow-lg shadow-primary/10"
              >
                {copiedToken ? 'Copied!' : 'Copy Token'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Provider ──────────────────────────────────────────────── */}
      <section className="animate-fadeIn" style={{ animationDelay: '120ms' }}>
        <SectionLabel icon={<Sparkles className="w-3.5 h-3.5" />}>AI Provider</SectionLabel>
        <div className="bg-card border border-cardBorder rounded-xl p-6 space-y-5 card-glow transition-all duration-200">
          {/* Provider selector */}
          <div className="space-y-1.5">
            <label className="block text-xs text-textMuted font-medium">Select Provider</label>
            <div className="relative">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                className="w-full appearance-none bg-white/[0.02] border border-cardBorder/50 rounded-lg px-3.5 py-2.5 pr-10
                           text-sm text-textPrimary cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                           transition-all duration-150"
              >
                <option value="none" className="bg-[#161b22]">Default Server-Side Provider (Gemini)</option>
                <option value="gemini" className="bg-[#161b22]">Google Gemini (Bring your own key)</option>
                <option value="openai" className="bg-[#161b22]">OpenAI</option>
                <option value="anthropic" className="bg-[#161b22]">Anthropic</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted pointer-events-none opacity-60" />
            </div>
          </div>

          {/* API key input — animated mount */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showKeyInput ? 'max-h-32 opacity-100 mt-2' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {showKeyInput && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs text-textMuted font-medium">
                  {meta.label} API Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-textMuted/50">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={apiKeys[aiProvider]}
                    onChange={(e) =>
                      setApiKeys({ ...apiKeys, [aiProvider]: e.target.value })
                    }
                    placeholder={meta.placeholder}
                    className="w-full bg-white/[0.02] border border-cardBorder/50 rounded-lg pl-10 pr-3.5 py-2.5
                               text-sm text-textPrimary font-mono
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                               transition-all duration-150
                               placeholder:text-textMuted/20"
                  />
                </div>
                {meta.hint && (
                  <p className="text-[11px] text-textMuted/60 flex items-center gap-1.5 ml-0.5">
                    <Shield className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                    {meta.hint}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className="border-t border-cardBorder/60 pt-4 flex items-center justify-between gap-3">
            <div
              className={`text-sm flex items-center gap-1.5 transition-all duration-300 ${
                saveState === 'saved'
                  ? 'opacity-100 text-green-400 translate-y-0'
                  : saveState === 'error'
                    ? 'opacity-100 text-red-400 translate-y-0'
                    : 'opacity-0 translate-y-1 pointer-events-none'
              }`}
            >
              {saveState === 'saved' && <><Check className="w-4.5 h-4.5" /> Settings saved</>}
              {saveState === 'error' && <>Failed to save. Try again.</>}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-lg bg-primary text-black text-sm font-bold
                         hover:brightness-110 active:scale-[0.97]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150 ease-out
                         flex items-center gap-2 shadow-lg shadow-primary/10"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Project Settings ─────────────────────────────────────────── */}
      <section className="animate-fadeIn" style={{ animationDelay: '160ms' }}>
        <SectionLabel icon={<Shield className="w-3.5 h-3.5" />}>Project Settings</SectionLabel>
        <div className="bg-card border border-cardBorder rounded-xl p-6 space-y-5 card-glow transition-all duration-200">
          {/* Project selector */}
          <div className="space-y-1.5">
            <label className="block text-xs text-textMuted font-medium">Select Project</label>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full appearance-none bg-white/[0.02] border border-cardBorder/50 rounded-lg px-3.5 py-2.5 pr-10
                           text-sm text-textPrimary cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                           transition-all duration-150"
              >
                <option value="" className="bg-[#161b22]">— Choose a project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#161b22]">{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted pointer-events-none opacity-60" />
            </div>
          </div>

          {/* Project details — animated mount */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              selectedProject ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {selectedProject && (
              <div className="space-y-5 pt-2 border-t border-cardBorder/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ReadOnlyField label="Project Name" value={selectedProject.name} />
                  <ReadOnlyField label="Default Branch" value={selectedProject.defaultBranch} mono />
                </div>

                <ReadOnlyField label="Repo URL" value={selectedProject.repoUrl} mono small />
                <ReadOnlyField
                  label="Preferred Model"
                  value={selectedProject.settings?.preferredModel || 'gemini-1.5-pro'}
                  mono
                />

                <div className="space-y-3.5 pt-2">
                  <ToggleDisplay
                    label="Redaction Enabled"
                    description="Sensitive data masked in logs"
                    icon={<Shield className="w-4 h-4" />}
                    enabled={selectedProject.settings?.redactionEnabled}
                  />
                  <ToggleDisplay
                    label="Auto Summaries"
                    description="Generate episode summaries automatically"
                    icon={<Sparkles className="w-4 h-4" />}
                    enabled={selectedProject.settings?.autoSummariesEnabled}
                  />
                </div>

                <p className="text-[11px] text-textMuted/50 border-t border-cardBorder/40 pt-4 text-center sm:text-left">
                  Project settings are managed via the VS Code extension.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/* ── Shared sub-components ──────────────────────────────────────────── */

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3 flex items-center gap-1.5 ml-1">
      {icon && <span className="opacity-80 text-primary">{icon}</span>}
      {children}
    </h2>
  )
}

function ReadOnlyField({
  label,
  value,
  mono = false,
  small = false,
}: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-textMuted font-medium">{label}</label>
      <div
        className={`w-full bg-white/[0.01] border border-cardBorder/30 rounded-lg px-3.5 py-2.5
                    ${small ? 'text-xs' : 'text-sm'} text-textMuted
                    ${mono ? 'font-mono' : ''}
                    hover:border-cardBorder/50 transition-colors duration-200
                    truncate`}
        title={value}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function ToggleDisplay({
  label,
  description,
  icon,
  enabled,
}: {
  label: string
  description: string
  icon: React.ReactNode
  enabled: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-white/[0.01] border border-cardBorder/30 hover:border-cardBorder/50 rounded-lg transition-all duration-200">
      <div className="flex items-center gap-3">
        <span className={`${enabled ? 'text-primary' : 'text-textMuted/30'} transition-colors duration-200`}>
          {icon}
        </span>
        <div>
          <p className="text-sm text-textPrimary font-medium">{label}</p>
          <p className="text-[11px] text-textMuted/60">{description}</p>
        </div>
      </div>
      <div
        className={`w-10 h-[22px] rounded-full transition-colors duration-200 relative cursor-default ${
          enabled ? 'bg-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]' : 'bg-white/[0.06] border border-cardBorder/60'
        }`}
      >
        <div
          className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
            enabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
    </div>
  )
}
