import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../lib/firestoreHooks'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: projects } = useProjects(user?.uid ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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
