import { memo } from 'react'
import { Code, Terminal, CheckCircle2, Copy, ExternalLink, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Badge } from '../components/ui/Badge'

export const SetupPage = memo(function SetupPage() {
  const { user } = useAuth()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Could add a toast here
  }

  const steps = [
    {
      title: 'Install Extension',
      description: 'Find "ContextLens" in the VS Code Marketplace and install it.',
      icon: <Code className="w-5 h-5 text-primary" />,
      action: (
        <a
          href="vscode:extension/noventra-Labs.contextlens"
          className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
        >
          Open in VS Code <ExternalLink className="w-3 h-3" />
        </a>
      ),
    },
    {
      title: 'Authenticate',
      description: 'Connect your VS Code extension to your account.',
      icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
      action: (
        <a
          href={`https://contextlens-backend-001.web.app/api/auth/login?uid=${user?.uid}&callback=vscode://noventra-Labs.contextlens`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Connect VS Code
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ),
    },
    {
      title: 'Initialize Project',
      description: 'Run the init command in your project root to start tracking.',
      icon: <Terminal className="w-5 h-5 text-primary" />,
      action: (
        <div className="flex items-center gap-2 bg-gray-900 border border-cardBorder rounded-md p-2 font-mono text-[10px] text-textPrimary">
          <span>npx contextlens init</span>
          <button
            onClick={() => copyToClipboard('npx contextlens init')}
            className="p-1 hover:text-primary transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-textPrimary mb-3">Setup ContextLens</h1>
        <p className="text-textMuted max-w-lg mx-auto">
          Capture every AI interaction, diff, and decision. Connect your local workspace to the cloud in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="bg-card border border-cardBorder rounded-xl p-6 flex flex-col relative"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              {step.icon}
            </div>
            <div className="absolute top-6 right-6 text-2xl font-bold text-primary/10">0{i + 1}</div>
            <h3 className="text-lg font-bold text-textPrimary mb-2">{step.title}</h3>
            <p className="text-sm text-textMuted mb-6 flex-1">{step.description}</p>
            <div>{step.action}</div>
          </div>
        ))}
      </div>

      <section className="bg-primary/5 border border-primary/10 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <Badge text="Pro Tip" variant="branch" className="mb-3" />
            <h2 className="text-xl font-bold text-textPrimary mb-3">
              Why connect your workspace?
            </h2>
            <ul className="space-y-3 text-sm text-textMuted">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Automatically sync AI chat history and diffs to the dashboard.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Get AI-powered summaries of your coding sessions.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Share your work progress with teammates effortlessly.</span>
              </li>
            </ul>
          </div>
          <div className="w-full md:w-1/3 bg-black/40 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <pre className="text-[10px] font-mono text-primary leading-relaxed">
              {`$ npx contextlens init
✔ Checking local environment
✔ Found git repository
✔ Authenticated as ${user?.displayName?.split(' ')[0] || 'User'}
✔ Project "contextlens" created
🚀 Monitoring active sessions...`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
})
