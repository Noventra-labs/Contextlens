import * as vscode from 'vscode';
import { AuthManager, setAuthManager, getAuthManager } from './auth';
import { EpisodeStore } from './episodeStore';
import { StateTreeProvider } from './stateTreeProvider';
import { ChatViewProvider } from './chatViewProvider';
import { ApiClient } from './apiClient';
import { GitContext } from './gitContext';
import { Telemetry } from './telemetry';
import { createHash } from 'crypto';
import { startWatchers } from './watchers';
import { ContextLensStatusBar } from './statusBar';
import { NotificationService } from './NotificationService';
import { ErrorMapper } from './ErrorMapper';

export function activate(context: vscode.ExtensionContext) {
  Telemetry.log('Extension activated');
  const notifier = NotificationService.getInstance();

  // ── Auth setup (must be FIRST) ───────────────────────────────────────────

  const authManager = new AuthManager(context);
  authManager.registerUriHandler();
  setAuthManager(authManager);

  EpisodeStore.initialize(context);

  const stateTreeProvider = new StateTreeProvider();
  vscode.window.registerTreeDataProvider('contextlens.stateTree', stateTreeProvider);

  const chatViewProvider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider)
  );

  // ── Status bar ───────────────────────────────────────────────────────────
  const statusBar = new ContextLensStatusBar(context, authManager);

  EpisodeStore.get().onDidChange(() => {
    statusBar.render();
    stateTreeProvider.refresh();
  });

  // ── Start Autonomous Watchers ───────────────────────────────────────────
  startWatchers({
    context,
    episodeStore: EpisodeStore.get(),
    apiClient: ApiClient,
    stateTreeProvider,
    statusBar: { render: () => statusBar.render() }
  });

  // ── First-load sign-in prompt ────────────────────────────────────────────

  (async () => {
    const existingAuth = await authManager.loadAuthState();
    if (existingAuth) {
      // Already signed in → auto-resolve project (only if workspace is open)
      if (vscode.workspace.workspaceFolders?.length) {
        try {
          await EpisodeStore.get().ensureProject();
        } catch (err: any) {
          console.error('[ContextLens] ensureProject failed on activation:', err);
        }
      }
      statusBar.render();
      stateTreeProvider.refresh();
    } else {
      // Not signed in → show a friendly prompt (non-blocking)
      const action = await vscode.window.showInformationMessage(
        'ContextLens: Sign in with Google to start logging AI sessions.',
        'Sign In'
      );
      if (action === 'Sign In') {
        vscode.commands.executeCommand('contextlens.signIn');
      }
    }
  })();

  // Re-resolve project after signing in
  authManager.onDidSignIn(async () => {
    if (vscode.workspace.workspaceFolders?.length) {
      try {
        await EpisodeStore.get().ensureProject();
      } catch (err: any) {
        console.error('[ContextLens] ensureProject failed after sign-in:', err);
        // Do not surface this to the user — sign-in itself succeeded.
      }
    }
    statusBar.render();
    stateTreeProvider.refresh();
  });

  // ── Auto-resolve when a folder is opened mid-session ────────────────────

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (vscode.workspace.workspaceFolders?.length) {
        const authState = await authManager.loadAuthState();
        if (authState) {
          await EpisodeStore.get().ensureProject();
        }
      }
      statusBar.render();
      stateTreeProvider.refresh();
    })
  );

  // ── Command: Sign In ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.signIn', async () => {
      const existing = await authManager.loadAuthState();
      if (existing) {
        vscode.window.showInformationMessage('ContextLens: Already authenticated ✦');
        return;
      }
      try {
        await authManager.ensureSignedIn();
      } catch (err: any) {
        // Error already shown by ensureSignedIn
      }
    })
  );

  // ── Command: Sign Out ────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.signOut', async () => {
      await authManager.signOut();
      statusBar.render();
      stateTreeProvider.refresh();
    })
  );

  // ── Command: New Episode ─────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.newEpisode', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Episode label? (e.g. "Add Rate Limiting")',
        placeHolder: 'Describe the coding task',
      });
      if (name) {
        await EpisodeStore.get().createEpisode(name);
        notifier.success(`Episode started: ${name}`);
        Telemetry.log('New Episode Created', { name });
      }
    })
  );

  // ── Command: Close Episode ───────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.closeEpisode', async () => {
      await EpisodeStore.get().closeEpisode();
      notifier.success('Episode closed.');
      Telemetry.log('Episode Closed');
    })
  );

  // ── Command: Explain Diff ────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.explainDiff', async () => {
      const store = EpisodeStore.get();
      const episode = store.getActiveEpisode();
      const projectId = store.getProjectId();

      if (!episode || !projectId) {
        notifier.warning('No active episode. Create one to start tracking.');
        return;
      }

      const gitCtx = await GitContext.getContext();
      if (!gitCtx.diff) {
        notifier.info('No diff available to explain yet.');
        return;
      }

      const diffHash = createHash('md5').update(gitCtx.diff).digest('hex');

      try {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Explaining diff…' },
          async () => {
            const result = await ApiClient.explainDiff({
              projectId,
              episodeId: episode.id,
              diffHash,
              changedFiles: episode.changedFiles,
            });

            const panel = vscode.window.createWebviewPanel(
              'contextlens.explainDiffResult',
              '✦ Gemini Diff Analysis',
              vscode.ViewColumn.Beside,
              {}
            );

            const risksHtml = result.risks.length
              ? result.risks.map((r: string) => `<li>⚠ ${r}</li>`).join('')
              : '<li>No risks identified</li>';

            const checksHtml = result.checks.length
              ? result.checks.map((c: string) => `<li>✓ ${c}</li>`).join('')
              : '<li>No specific checks suggested</li>';

            panel.webview.html = `<!DOCTYPE html>
<html><head><style>
  body { font-family: var(--vscode-font-family, system-ui); padding: 20px; color: var(--vscode-foreground, #ccc); background: var(--vscode-editor-background, #1e1e1e); }
  h2 { border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 8px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  .section { margin-bottom: 20px; }
</style></head><body>
  <h2>✦ Gemini Diff Analysis</h2>
  <div class="section"><h3>Summary</h3><p>${result.summary}</p></div>
  <div class="section"><h3>⚠ Potential Risks</h3><ul>${risksHtml}</ul></div>
  <div class="section"><h3>✓ Suggested Checks</h3><ul>${checksHtml}</ul></div>
</body></html>`;
          }
        );

        Telemetry.log('Explain Diff executed');
      } catch (err: any) {
        const mapped = ErrorMapper.map(err);
        notifier.fromMapped(mapped);
      }
    })
  );

  // ── Command: Summarize Branch ────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.summarizeBranch', async () => {
      const store = EpisodeStore.get();
      const projectId = store.getProjectId();

      if (!projectId) {
        notifier.warning('No project detected. Open a folder to get started.');
        return;
      }

      const gitCtx = await GitContext.getContext();
      if (!gitCtx.branch) {
        notifier.warning('No Git branch detected.');
        return;
      }

      try {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Summarizing branch…' },
          async () => {
            const result = await ApiClient.summarizeBranch({
              projectId,
              branchName: gitCtx.branch!,
            });
            vscode.window.showInformationMessage(`Branch Summary: ${result.pr_summary.substring(0, 200)}…`);
          }
        );
        Telemetry.log('Summarize Branch executed');
      } catch (err: any) {
        const mapped = ErrorMapper.map(err);
        notifier.fromMapped(mapped);
      }
    })
  );

  // ── Command: Open Dashboard (project level) ──────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.openDashboard', async () => {
      await EpisodeStore.get().forceSync(); // Sync before opening dashboard
      const projectId = EpisodeStore.get().getProjectId();
      if (!projectId) {
        const action = await vscode.window.showInformationMessage(
          'ContextLens: Open a folder to start tracking a project.',
          'Open Folder'
        );
        if (action === 'Open Folder') {
          vscode.commands.executeCommand('vscode.openFolder');
        }
        return;
      }
      vscode.env.openExternal(vscode.Uri.parse(ApiClient.dashboardUrl(projectId)));
      Telemetry.log('Dashboard Opened', { target: 'project' });
    })
  );

  // ── Command: Open Dashboard (episode level) ──────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.openDashboardEpisode', async () => {
      await EpisodeStore.get().forceSync(); // Sync before opening episode
      const store = EpisodeStore.get();
      const projectId = store.getProjectId();
      const episode = store.getActiveEpisode();

      if (!projectId) {
        notifier.warning('No project detected. Open a folder to get started.');
        return;
      }

      if (episode) {
        vscode.env.openExternal(
          vscode.Uri.parse(ApiClient.dashboardEpisodeUrl(projectId, episode.id))
        );
      } else {
        vscode.env.openExternal(vscode.Uri.parse(ApiClient.dashboardUrl(projectId)));
      }
      Telemetry.log('Dashboard Opened', { target: 'episode' });
    })
  );

  // ── Command: Open Dashboard (branch level) ───────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.openDashboardBranch', async () => {
      await EpisodeStore.get().forceSync(); // Sync before opening branch
      const projectId = EpisodeStore.get().getProjectId();
      if (!projectId) {
        notifier.warning('No project detected. Open a folder to get started.');
        return;
      }

      const gitCtx = await GitContext.getContext();
      if (!gitCtx.branch) {
        notifier.warning('No Git branch detected.');
        return;
      }

      vscode.env.openExternal(
        vscode.Uri.parse(ApiClient.dashboardBranchUrl(projectId, gitCtx.branch))
      );
      Telemetry.log('Dashboard Opened', { target: 'branch' });
    })
  );

  // ── Command: Log External AI Call ────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.logExternalCall', async () => {
      const store = EpisodeStore.get();
      const episode = store.getActiveEpisode();
      const projectId = store.getProjectId();

      if (!episode || !projectId) {
        notifier.warning('No active episode. Create one to start tracking.');
        return;
      }

      const tool = await vscode.window.showQuickPick(
        ['Claude', 'ChatGPT', 'Copilot', 'Other'],
        { placeHolder: 'Which AI tool did you use?' }
      );
      if (!tool) return;

      const intentTag = await vscode.window.showInputBox({
        prompt: 'Intent tag (what was this about?)',
        placeHolder: 'e.g. "Claude design discussion for auth"',
      });
      if (intentTag === undefined) return;

      const promptText = await vscode.window.showInputBox({
        prompt: 'Paste your prompt or key question',
        placeHolder: 'What did you ask?',
      });
      if (!promptText) return;

      const modelResponse = await vscode.window.showInputBox({
        prompt: 'Paste the AI response or key decisions',
        placeHolder: 'What did the AI respond?',
      });
      if (!modelResponse) return;

      const gitCtx = await GitContext.getContext();

      try {
        store.enqueueCall({
          source: 'manual_log',
          modelName: tool.toLowerCase(),
          intentTag: intentTag || undefined,
          promptText,
          modelResponse,
          branchName: gitCtx.branch || undefined,
          activeFilePath: gitCtx.activeFile || undefined,
          relatedFiles: [],
          diffSnapshot: gitCtx.diff || null,
          todoMatches: gitCtx.markers,
        });

        store.incrementCallCount();
        notifier.success(`${tool} call logged to "${episode.name}"`);
        Telemetry.log('External Call Logged', { tool });
      } catch (err: any) {
        const mapped = ErrorMapper.map(err);
        notifier.fromMapped(mapped);
      }
    })
  );

  // ── Command: Configure AI Provider ──────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('contextlens.configureProvider', async () => {
      const authState = await authManager.loadAuthState();
      if (!authState) {
        notifier.warning('Sign in first to configure your AI provider.', {
          action: { label: 'Sign In', onAction: () => vscode.commands.executeCommand('contextlens.signIn') },
        });
        return;
      }

      // Fetch current settings
      let currentSettings: { aiProvider: string; hasGeminiKey: boolean; hasOpenaiKey: boolean; hasAnthropicKey: boolean };
      try {
        currentSettings = await ApiClient.getSettings();
      } catch {
        currentSettings = { aiProvider: 'none', hasGeminiKey: false, hasOpenaiKey: false, hasAnthropicKey: false };
      }

      const providerPick = await vscode.window.showQuickPick(
        [
          { label: '$(server) Default (Server-side Gemini)', value: 'none', description: 'Uses the server\'s built-in Gemini key' },
          { label: '$(key) Gemini (Bring your own key)', value: 'gemini', description: currentSettings.hasGeminiKey ? '✓ Key configured' : 'No key set' },
          { label: '$(key) OpenAI', value: 'openai', description: currentSettings.hasOpenaiKey ? '✓ Key configured' : 'No key set' },
          { label: '$(key) Anthropic', value: 'anthropic', description: currentSettings.hasAnthropicKey ? '✓ Key configured' : 'No key set' },
        ],
        {
          placeHolder: `Current provider: ${currentSettings.aiProvider === 'none' ? 'Default (Server Gemini)' : currentSettings.aiProvider}`,
          title: 'ContextLens: Select AI Provider',
        }
      );

      if (!providerPick) return;

      const selectedProvider = providerPick.value;

      // If selecting a BYO-key provider, prompt for the key
      if (selectedProvider !== 'none') {
        const keyPlaceholder = selectedProvider === 'gemini' ? 'AIzaSy...' : selectedProvider === 'openai' ? 'sk-...' : 'sk-ant-...';
        const apiKey = await vscode.window.showInputBox({
          prompt: `Enter your ${selectedProvider} API key (leave blank to keep existing)`,
          placeHolder: keyPlaceholder,
          password: true,
          ignoreFocusOut: true,
        });

        // User cancelled the input
        if (apiKey === undefined) return;

        try {
          const updateBody: any = { aiProvider: selectedProvider };
          if (apiKey) {
            updateBody[`${selectedProvider}ApiKey`] = apiKey;
          }
          await ApiClient.updateSettings(updateBody);

          // Cache the API key locally in VS Code SecretStorage for offline/fast access
          if (apiKey) {
            await context.secrets.store(`contextlens.apiKey.${selectedProvider}`, apiKey);
          }
          // Remember which provider is active
          await context.secrets.store('contextlens.activeProvider', selectedProvider);

          vscode.window.showInformationMessage(`ContextLens: Provider set to ${selectedProvider}${apiKey ? ' with new API key' : ''} ✦`);
        } catch (err: any) {
          const mapped = ErrorMapper.map(err);
          notifier.fromMapped(mapped);
          return;
        }
      } else {
        try {
          await ApiClient.updateSettings({ aiProvider: 'none' });
          vscode.window.showInformationMessage('ContextLens: Using default server-side Gemini ✦');
        } catch (err: any) {
          const mapped = ErrorMapper.map(err);
          notifier.fromMapped(mapped);
          return;
        }
      }

      // Refresh status bar to show updated provider
      statusBar.render();
      Telemetry.log('Provider Configured', { provider: selectedProvider });
    })
  );

  // ── Deactivation ──────────────────────────────────────────────────────────
  context.subscriptions.push({
    dispose: () => {
      statusBar.hide();
      statusBar.dispose();
    }
  });
}

export function deactivate() {}
