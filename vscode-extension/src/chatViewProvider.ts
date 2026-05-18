import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import { GitContext } from './gitContext';
import { EpisodeStore } from './episodeStore';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'contextlens.chatView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async data => {
      switch (data.type) {
        case 'sendMessage':
          {
            const episode = EpisodeStore.get().getActiveEpisode();
            const projectId = EpisodeStore.get().getProjectId();
            if (!episode || !projectId) {
              vscode.window.showErrorMessage('No active episode. Create one first.');
              this._view?.webview.postMessage({ type: 'error', value: 'No active episode' });
              return;
            }

            const gitCtx = await GitContext.getContext();
            const intentTag = data.intentTag || undefined;

            try {
              const res = await ApiClient.logCall({
                projectId,
                episodeId: episode.id,
                promptText: data.value,
                intentTag,
                source: 'extension',
                branchName: gitCtx.branch || undefined,
                activeFilePath: gitCtx.activeFile || undefined,
                relatedFiles: [],
                diffSnapshot: gitCtx.diff || null,
                todoMatches: gitCtx.markers,
              });
              EpisodeStore.get().incrementCallCount();
              if (gitCtx.activeFile) {
                EpisodeStore.get().addChangedFile(gitCtx.activeFile);
              }
              this._view?.webview.postMessage({ type: 'addResponse', value: res.modelResponse });
            } catch (e: any) {
              this._view?.webview.postMessage({ type: 'error', value: e.message || 'Failed to send' });
            }
            break;
          }
      }
    });
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ContextLens Chat</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: var(--vscode-font-family, system-ui, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            padding: 12px;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background, transparent);
            display: flex;
            flex-direction: column;
            height: 100vh;
          }

          #chat-history {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 12px;
            border: 1px solid var(--vscode-panel-border, #333);
            border-radius: 6px;
            padding: 10px;
            background: var(--vscode-editor-background, #1e1e1e);
          }

          .message {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 8px;
            line-height: 1.5;
            word-wrap: break-word;
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .user-msg {
            background: var(--vscode-badge-background, #0078d4);
            color: var(--vscode-badge-foreground, #fff);
            margin-left: 20%;
            border-bottom-right-radius: 2px;
          }

          .ai-msg {
            background: var(--vscode-editorWidget-background, #252526);
            border: 1px solid var(--vscode-panel-border, #333);
            margin-right: 20%;
            border-bottom-left-radius: 2px;
          }

          .error-msg {
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
            color: var(--vscode-errorForeground, #f48771);
            margin-right: 20%;
            border-bottom-left-radius: 2px;
          }

          .sender {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 4px;
            opacity: 0.8;
          }

          /* Loading spinner */
          .loading-msg {
            margin-right: 20%;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--vscode-descriptionForeground, #888);
            font-style: italic;
          }

          .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-descriptionForeground, #555);
            border-top-color: var(--vscode-focusBorder, #007fd4);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* Input area */
          .input-area {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          #intent {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          }

          #intent:focus { border-color: var(--vscode-focusBorder, #007fd4); }

          #prompt {
            width: 100%;
            min-height: 60px;
            padding: 8px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            outline: none;
          }

          #prompt:focus { border-color: var(--vscode-focusBorder, #007fd4); }

          .btn-row {
            display: flex;
            gap: 6px;
          }

          button {
            flex: 1;
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: opacity 0.15s;
          }

          button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
          button:disabled { opacity: 0.5; cursor: not-allowed; }

          #retry-btn {
            background: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #ccc);
          }

          .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div id="chat-history"></div>

        <div class="input-area">
          <input type="text" id="intent" placeholder="Intent tag (optional — e.g. &quot;auth refactor&quot;)" />
          <textarea id="prompt" placeholder="Ask Gemini anything..."></textarea>
          <div class="btn-row">
            <button id="send-btn">✦ Send</button>
            <button id="retry-btn">↻ Retry</button>
          </div>
          <div class="hint">Ctrl+Enter to send</div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const sendBtn = document.getElementById('send-btn');
          const retryBtn = document.getElementById('retry-btn');
          const promptInput = document.getElementById('prompt');
          const intentInput = document.getElementById('intent');
          const chatHistory = document.getElementById('chat-history');
          let lastPrompt = '';
          let isLoading = false;

          function setLoading(loading) {
            isLoading = loading;
            sendBtn.disabled = loading;
            retryBtn.disabled = loading;
            promptInput.disabled = loading;

            // Remove any existing loading indicator
            const existing = document.getElementById('loading-indicator');
            if (existing) existing.remove();

            if (loading) {
              const div = document.createElement('div');
              div.id = 'loading-indicator';
              div.className = 'message loading-msg';
              div.innerHTML = '<div class="spinner"></div> Gemini is thinking...';
              chatHistory.appendChild(div);
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }
          }

          function sendMessage() {
            const text = promptInput.value.trim();
            if (!text || isLoading) return;
            lastPrompt = text;
            const intentTag = intentInput.value.trim() || undefined;
            addMessage('You', text, 'user-msg');
            setLoading(true);
            vscode.postMessage({ type: 'sendMessage', value: text, intentTag });
            promptInput.value = '';
          }

          sendBtn.addEventListener('click', sendMessage);

          retryBtn.addEventListener('click', () => {
            if (!lastPrompt || isLoading) return;
            addMessage('You (Retry)', lastPrompt, 'user-msg');
            setLoading(true);
            vscode.postMessage({ type: 'sendMessage', value: lastPrompt });
          });

          // Ctrl+Enter to send
          promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              sendMessage();
            }
          });

          window.addEventListener('message', event => {
            const message = event.data;
            setLoading(false);
            switch (message.type) {
              case 'addResponse':
                addMessage('Gemini ✦', message.value, 'ai-msg');
                break;
              case 'error':
                addMessage('Error', message.value, 'error-msg');
                break;
            }
          });

          function addMessage(sender, text, className) {
            const div = document.createElement('div');
            div.className = 'message ' + className;
            div.innerHTML = '<div class="sender">' + escapeHtml(sender) + '</div>' + escapeHtml(text).replace(/\\n/g, '<br>');
            chatHistory.appendChild(div);
            chatHistory.scrollTop = chatHistory.scrollHeight;
          }

          function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
          }
        </script>
      </body>
      </html>`;
  }
}
