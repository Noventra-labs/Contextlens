import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

const canvasId = "session-board";
const defaultTitle = "Session Board";
const defaultNote = "Write a note, then use the canvas actions to update it.";

const servers = new Map();

function stateRoot(session) {
    if (session.workspacePath) {
        return join(session.workspacePath, ".canvas-state", canvasId);
    }
    return join(tmpdir(), "copilot-canvas", canvasId);
}

function statePath(session) {
    return join(stateRoot(session), "state.json");
}

async function loadState(session, seed) {
    const file = statePath(session);
    await mkdir(dirname(file), { recursive: true });

    try {
        const raw = await readFile(file, "utf8");
        return JSON.parse(raw);
    } catch {
        const state = {
            title: seed?.title?.trim() || defaultTitle,
            note: seed?.note?.trim() || defaultNote,
            log: [],
            updatedAt: new Date().toISOString(),
        };
        await writeFile(file, JSON.stringify(state, null, 2), "utf8");
        return state;
    }
}

async function saveState(session, state) {
    await mkdir(stateRoot(session), { recursive: true });
    await writeFile(statePath(session), JSON.stringify(state, null, 2), "utf8");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderHtml(instanceId, state) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(state.title)}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--font-sans, system-ui, sans-serif);
        background: var(--background-color-default, #ffffff);
        color: var(--text-color-default, #1f2328);
      }
      body {
        margin: 0;
        padding: 16px;
        background: var(--background-color-default, #ffffff);
        color: var(--text-color-default, #1f2328);
      }
      .card {
        border: 1px solid var(--border-color-default, #d0d7de);
        border-radius: 12px;
        padding: 16px;
        background: var(--background-color-default, #ffffff);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 20px;
      }
      textarea {
        width: 100%;
        min-height: 180px;
        box-sizing: border-box;
        resize: vertical;
        border-radius: 8px;
        border: 1px solid var(--border-color-default, #d0d7de);
        padding: 12px;
        background: var(--background-color-default, #ffffff);
        color: var(--text-color-default, #1f2328);
        font: inherit;
      }
      .row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      button {
        border: 1px solid var(--border-color-default, #d0d7de);
        border-radius: 999px;
        padding: 8px 12px;
        background: var(--background-color-muted, #f6f8fa);
        color: var(--text-color-default, #1f2328);
        cursor: pointer;
      }
      .meta {
        margin-top: 12px;
        font-size: 12px;
        color: var(--text-color-muted, #57606a);
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--background-color-muted, #f6f8fa);
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0 0;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 id="title"></h1>
      <textarea id="note" placeholder="Write something..."></textarea>
      <div class="row">
        <button id="save">Save note</button>
        <button id="append">Append timestamp</button>
        <button id="clear">Clear</button>
      </div>
      <div class="meta" id="meta"></div>
      <pre id="log"></pre>
    </div>
    <script>
      const instanceId = ${JSON.stringify(instanceId)};
      const titleEl = document.getElementById("title");
      const noteEl = document.getElementById("note");
      const metaEl = document.getElementById("meta");
      const logEl = document.getElementById("log");

      async function refresh() {
        const response = await fetch("./state", { cache: "no-store" });
        const state = await response.json();
        titleEl.textContent = state.title;
        noteEl.value = state.note;
        metaEl.textContent = "Instance " + instanceId + " • Updated " + state.updatedAt;
        logEl.textContent = state.log.join("\\n");
      }

      async function run(action, payload = {}) {
        const response = await fetch("./action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        await refresh();
      }

      document.getElementById("save").addEventListener("click", () => run("set_note", { note: noteEl.value }));
      document.getElementById("append").addEventListener("click", () => run("append_note", { note: new Date().toISOString() }));
      document.getElementById("clear").addEventListener("click", () => run("clear_note"));

      refresh();
      setInterval(refresh, 5000);
    </script>
  </body>
</html>`;
}

async function startServer(session, instanceId, seed) {
    const entry = {
        state: await loadState(session, seed),
    };

    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (req.method === "GET" && url.pathname === "/") {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderHtml(instanceId, entry.state));
            return;
        }

        if (req.method === "GET" && url.pathname === "/state") {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(entry.state));
            return;
        }

        if (req.method === "POST" && url.pathname === "/action") {
            const body = await new Promise((resolve, reject) => {
                const chunks = [];
                req.on("data", (chunk) => chunks.push(chunk));
                req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
                req.on("error", reject);
            });
            const payload = JSON.parse(body || "{}");

            if (payload.action === "set_note") {
                entry.state.note = String(payload.note ?? "").trim();
                entry.state.log.unshift(`[${new Date().toISOString()}] note saved`);
            } else if (payload.action === "append_note") {
                const line = String(payload.note ?? "").trim();
                entry.state.note = entry.state.note ? `${entry.state.note}\n${line}` : line;
                entry.state.log.unshift(`[${new Date().toISOString()}] note appended`);
            } else if (payload.action === "clear_note") {
                entry.state.note = "";
                entry.state.log.unshift(`[${new Date().toISOString()}] note cleared`);
            } else {
                res.statusCode = 400;
                res.end("Unknown action");
                return;
            }

            entry.state.updatedAt = new Date().toISOString();
            await saveState(session, entry.state);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        res.statusCode = 404;
        res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    entry.server = server;
    entry.url = `http://127.0.0.1:${port}/`;
    return entry;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: canvasId,
            displayName: "Session Board",
            description: "A small canvas for keeping a running note during the session.",
            inputSchema: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    note: { type: "string" },
                },
                additionalProperties: false,
            },
            actions: [
                {
                    name: "set_note",
                    description: "Replace the board note with new text.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            note: { type: "string" },
                        },
                        required: ["note"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) {
                            throw new CanvasError("canvas_not_open", "Open the canvas before updating the note.");
                        }
                        entry.state.note = ctx.input.note.trim();
                        entry.state.log.unshift(`[${new Date().toISOString()}] note saved`);
                        entry.state.updatedAt = new Date().toISOString();
                        await saveState(session, entry.state);
                        return entry.state;
                    },
                },
                {
                    name: "append_note",
                    description: "Append a line to the board note.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            note: { type: "string" },
                        },
                        required: ["note"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) {
                            throw new CanvasError("canvas_not_open", "Open the canvas before updating the note.");
                        }
                        const line = ctx.input.note.trim();
                        entry.state.note = entry.state.note ? `${entry.state.note}\n${line}` : line;
                        entry.state.log.unshift(`[${new Date().toISOString()}] note appended`);
                        entry.state.updatedAt = new Date().toISOString();
                        await saveState(session, entry.state);
                        return entry.state;
                    },
                },
                {
                    name: "clear_note",
                    description: "Clear the board note.",
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) {
                            throw new CanvasError("canvas_not_open", "Open the canvas before updating the note.");
                        }
                        entry.state.note = "";
                        entry.state.log.unshift(`[${new Date().toISOString()}] note cleared`);
                        entry.state.updatedAt = new Date().toISOString();
                        await saveState(session, entry.state);
                        return entry.state;
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(session, ctx.instanceId, ctx.input);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: entry.state.title,
                    status: `Note saved ${entry.state.updatedAt}`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
