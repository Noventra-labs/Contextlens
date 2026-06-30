/* =========================================================
   ContextLens — Interactivity
   ========================================================= */
(() => {
  'use strict';

  /* ---------- HERO 3D-LIKE CANVAS (particles + lines) ---------- */
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w, h, cx, cy, particles = [];
    const NODE_DATA = [
      { label: 'Claude', desc: 'Exposes workspace://git-diff & symbols' },
      { label: 'Cursor', desc: 'Provides search_context & explain_diff' },
      { label: 'Gemini', desc: 'Powers AI summaries & search embeddings' },
      { label: 'VS Code', desc: 'Triggers watchers for active files' },
      { label: 'Git', desc: 'Tracks branch commits & staged files' },
      { label: 'Terminal', desc: 'Captures executed commands & outputs' },
      { label: 'Docker', desc: 'Inspects container states & logs' },
      { label: 'GitHub', desc: 'Syncs issues, PRs & milestones' }
    ];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Load active accent colors dynamically from design tokens
    const style = getComputedStyle(document.documentElement);
    const colorCyan = style.getPropertyValue('--cyan').trim() || '#22D3EE';
    const colorPurple = style.getPropertyValue('--purple').trim() || '#e8943a';

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      cx = w / 2; cy = h / 2;
      // Build particles on a circle around the core
      const radius = Math.min(w, h) * 0.34;
      particles = NODE_DATA.map((node, i) => {
        const a = (i / NODE_DATA.length) * Math.PI * 2;
        return {
          label: node.label,
          desc: node.desc,
          x: cx + Math.cos(a) * radius,
          y: cy + Math.sin(a) * radius,
          ox: Math.cos(a) * radius,
          oy: Math.sin(a) * radius,
          pulse: Math.random() * Math.PI * 2,
        };
      });
    }
    resize();
    window.addEventListener('resize', resize);

    // Track mouse hover positions
    let hoverNode = null;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      hoverNode = null;
      particles.forEach(p => {
        const dx = p.x - mx;
        const dy = p.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          hoverNode = p;
        }
      });
    });
    canvas.addEventListener('mouseleave', () => {
      hoverNode = null;
    });

    let rot = 0;
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      rot += reduceMotion ? 0 : 0.0025;
      const cos = Math.cos(rot), sin = Math.sin(rot);

      // Core cube (drawn as nested squares + glow)
      const coreSize = Math.min(w, h) * 0.16;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(34,211,238,0.05)';
      ctx.fillRect(-coreSize, -coreSize, coreSize * 2, coreSize * 2);
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-coreSize, -coreSize, coreSize * 2, coreSize * 2);
      ctx.strokeRect(-coreSize * 0.6, -coreSize * 0.6, coreSize * 1.2, coreSize * 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, coreSize * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232,148,58,0.4)';
      ctx.stroke();
      // glow
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize * 2);
      g.addColorStop(0, 'rgba(34,211,238,0.18)');
      g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-coreSize * 2, -coreSize * 2, coreSize * 4, coreSize * 4);
      ctx.restore();

      // Particles + lines
      particles.forEach((p, i) => {
        // Rotate
        const x = cx + p.ox * cos - p.oy * sin;
        const y = cy + p.ox * sin + p.oy * cos;
        p.x = x; p.y = y;
        p.pulse += reduceMotion ? 0 : 0.04;

        const isHovered = hoverNode === p;

        // Draw line to center
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        const grad = ctx.createLinearGradient(cx, cy, x, y);
        if (isHovered) {
          grad.addColorStop(0, 'rgba(34,211,238,0.7)');
          grad.addColorStop(1, 'rgba(232,148,58,0.4)');
        } else {
          grad.addColorStop(0, 'rgba(34,211,238,0.35)');
          grad.addColorStop(1, 'rgba(232,148,58,0.1)');
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = isHovered ? 1.8 : 1;
        ctx.stroke();

        // Packet along the line (every few particles, every few frames)
        if (!reduceMotion && i % 2 === 0 && (Math.floor(p.pulse) % 40) < 6) {
          const tp = (Math.floor(p.pulse) % 40) / 40;
          const px = cx + (x - cx) * tp;
          const py = cy + (y - cy) * tp;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#22D3EE';
          ctx.fill();
        }

        // Node
        ctx.beginPath();
        const baseRadius = isHovered ? 7 : 4;
        ctx.arc(x, y, baseRadius + Math.sin(p.pulse) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? colorCyan : colorPurple;
        ctx.shadowColor = isHovered ? colorCyan : colorPurple;
        ctx.shadowBlur = isHovered ? 15 : 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(212,207,201,0.85)';
        ctx.font = isHovered ? 'bold 12px Inter, system-ui, sans-serif' : '500 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, x, y - 16);
      });

      // Render tooltip for hovered nodes
      if (hoverNode) {
        ctx.save();
        ctx.fillStyle = 'rgba(26, 25, 23, 0.95)';
        ctx.strokeStyle = colorCyan;
        ctx.lineWidth = 1;

        ctx.font = '11px var(--mono)';
        const textWidth = ctx.measureText(hoverNode.desc).width;
        const padX = 12, padY = 8;
        const tw = textWidth + padX * 2;
        const th = 14 + padY * 2;

        let tx = hoverNode.x - tw / 2;
        let ty = hoverNode.y - th - 26;

        // Keep tooltip inside canvas bounds
        tx = Math.max(10, Math.min(tx, w - tw - 10));
        ty = Math.max(10, ty);

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(tx, ty, tw, th, 6);
        } else {
          ctx.rect(tx, ty, tw, th);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = colorCyan;
        ctx.fillText(hoverNode.desc, tx + padX, ty + padY + 11);
        ctx.restore();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- TERMINAL TYPING + REPLAYS ---------- */
  function initTerminal() {
    const out = document.getElementById('terminal');
    const btns = document.querySelectorAll('.terminal__cmds button');
    if (!out || !btns.length) return;

    let activeCmdSpan = null;
    let isTyping = false;

    // Build nodes
    function span(cls, text) { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; }
    function txt(text) { return document.createTextNode(text); }
    function promptLine(content, withCaret) {
      const l = document.createElement('div'); l.className = 't-line';
      l.append(span('t-prompt', '$'), txt(' '), content);
      if (withCaret) l.append(span('t-caret', '▍'));
      return l;
    }
    function outputLine(...parts) {
      const l = document.createElement('div'); l.className = 't-line';
      parts.forEach(p => l.append(p));
      return l;
    }
    function outputBlock(...children) {
      const w = document.createElement('div'); w.className = 't-out';
      children.forEach(c => w.append(c));
      return w;
    }
    function blankCmd() {
      const c = document.createElement('span'); c.className = 't-cmd'; c.textContent = ''; return c;
    }

    // Each command produces a list of DOM nodes to append after the prompt line
    const FACTORIES = {
      doctor: () => outputBlock(
        outputLine(span('t-ok', '✔'), txt('Bridge running on '), span('t-mono', '127.0.0.1:3012')),
        outputLine(span('t-ok', '✔'), txt('9 tools registered · 5 resources · 5 prompts')),
        outputLine(span('t-ok', '✔'), txt('Token rotated 12s ago · TTL 30m')),
        outputLine(span('t-muted', '…'), txt(' '), span('t-mono', 'explain_diff'), txt(' over '), span('t-mono', '@feat/auth')),
      ),
      start: () => outputBlock(
        outputLine(span('t-ok', '✔'), txt('Episode '), span('t-mono', '#4281'), txt(' started')),
        outputLine(span('t-muted', '·'), txt(' watching '), span('t-mono', '5'), txt(' open files in workspace')),
        outputLine(span('t-muted', '·'), txt(' sync engine '), span('t-ok', 'idle')),
      ),
      search: () => outputBlock(
        outputLine(span('t-ok', '✔'), txt('3 results for '), span('t-mono', '"authentication bug"')),
        outputLine(span('t-mono', 'EP-0419'), txt('  3d ago  '), span('t-out', '"session expiry not enforced"')),
        outputLine(span('t-mono', 'EP-0382'), txt(' 11d ago  '), span('t-out', '"OAuth state mismatch"')),
        outputLine(span('t-mono', 'EP-0310'), txt(' 22d ago  '), span('t-out', '"callback redirect loop"')),
      ),
      logs: () => outputBlock(
        outputLine(span('t-out', '[12:04:18]'), txt(' '), span('t-mono', 'req'), txt(' explain_diff  200  '), span('t-out', '38ms')),
        outputLine(span('t-out', '[12:04:21]'), txt(' '), span('t-mono', 'req'), txt(' search_context 200 '), span('t-out', '104ms')),
        outputLine(span('t-out', '[12:04:33]'), txt(' '), span('t-mono', 'req'), txt(' start_episode  201  '), span('t-out', '12ms')),
      ),
    };

    function removeCarets() {
      out.querySelectorAll('.t-caret').forEach(c => c.remove());
    }

    function appendFreshPrompt() {
      removeCarets();
      const cmdSpan = blankCmd();
      const l = promptLine(cmdSpan, true);
      out.appendChild(l);
      return cmdSpan;
    }

    function typeInto(cmdSpan, text, done) {
      let i = 0;
      function tick() {
        cmdSpan.textContent = text.slice(0, i);
        if (i <= text.length) {
          i++;
          setTimeout(tick, 22 + Math.random() * 30);
        } else {
          done && done();
        }
      }
      tick();
    }

    function run(cmd, factory) {
      if (isTyping || !activeCmdSpan) return;
      isTyping = true;
      typeInto(activeCmdSpan, cmd, () => {
        out.appendChild(factory());
        activeCmdSpan = appendFreshPrompt();
        isTyping = false;
        out.scrollTop = out.scrollHeight;
      });
    }

    // Wire buttons
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        run(btn.dataset.cmd, FACTORIES[btn.dataset.output]);
      });
    });

    // On load: clear terminal and animate the FIRST command
    const firstTyped = document.getElementById('typed');
    if (firstTyped) {
      out.innerHTML = '';
      isTyping = true;
      activeCmdSpan = appendFreshPrompt();

      setTimeout(() => {
        typeInto(activeCmdSpan, 'npx @contextlens/cli mcp doctor', () => {
          out.appendChild(FACTORIES.doctor());
          activeCmdSpan = appendFreshPrompt();
          isTyping = false;
        });
      }, 500);
    }
  }

  /* ---------- MCP EXPLORER ---------- */
  function initMcp() {
    const tabs = document.querySelectorAll('.chip');
    const groups = document.querySelectorAll('.mcp__group');
    const search = document.getElementById('mcp-search');
    if (!tabs.length) return;

    function switchTab(tabId) {
      tabs.forEach(x => {
        const active = x.dataset.tab === tabId;
        x.classList.toggle('is-active', active);
      });
      groups.forEach(g => {
        g.hidden = g.dataset.group !== tabId;
      });
      // Hide detail panel on tab switch
      const detail = document.getElementById('mcp-detail');
      if (detail) detail.hidden = true;
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        switchTab(t.dataset.tab);
        if (search) search.value = '';
        // Reset visibility
        document.querySelectorAll('.mcp-table tbody tr:not(.mcp-table__no-results)').forEach(r => r.classList.remove('is-hidden'));
        document.querySelectorAll('.mcp-table__no-results').forEach(r => r.hidden = true);
      });
    });

    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        const terms = q ? q.split(/\s+/) : [];

        groups.forEach(group => {
          if (group.hidden) return; // Only process visible group
          const rows = group.querySelectorAll('.mcp-table tbody tr:not(.mcp-table__no-results)');
          const noResultsRow = group.querySelector('.mcp-table__no-results');
          let visibleCount = 0;

          rows.forEach(r => {
            let matches = true;
            if (terms.length > 0) {
              const searchStr = r.dataset.search ? r.dataset.search.toLowerCase() : '';
              matches = terms.every(term => searchStr.includes(term));
            }
            r.classList.toggle('is-hidden', !matches);
            if (matches) visibleCount++;
          });

          if (noResultsRow) {
            noResultsRow.hidden = (visibleCount > 0);
          }
        });
      });
    }

    // Check location hash on page load to see if we should jump to a tab
    const hash = window.location.hash;
    if (hash === '#resources') {
      switchTab('resources');
    } else if (hash === '#prompts') {
      switchTab('prompts');
    }

    // Detail content
    const details = {
      get_status: {
        purpose: 'Returns bridge health, uptime, and tool/resource counts.',
        perm: 'workspace:read',
        input: `{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}`,
        output: `{
  "ok": true,
  "version": "1.0.0",
  "uptimeSec": 12483,
  "tools": 9,
  "resources": 5,
  "prompts": 5
}`,
        req: `{ "tool": "get_status" }`,
        res: `{
  "ok": true,
  "version": "1.0.0",
  "uptimeSec": 12483
}`,
      },
      start_episode: {
        purpose: 'Open a new episode bound to the current workspace.',
        perm: 'workspace:write',
        input: `{
  "type": "object",
  "required": ["title"],
  "properties": {
    "title": { "type": "string", "maxLength": 200 }
  }
}`,
        output: `{
  "episode": {
    "id": "ep-4281",
    "title": "Ship OAuth",
    "startedAt": "2026-06-30T14:18:00Z"
  }
}`,
        req: `{ "tool": "start_episode", "title": "Ship OAuth" }`,
        res: `{
  "episode": { "id": "ep-4281", "title": "Ship OAuth" }
}`,
      },
      close_episode: {
        purpose: 'Close the active episode with an optional summary.',
        perm: 'workspace:write',
        input: `{
  "type": "object",
  "properties": { "summary": { "type": "string" } }
}`,
        output: `{
  "id": "ep-4281",
  "closedAt": "2026-06-30T18:42:11Z"
}`,
        req: `{ "tool": "close_episode", "summary": "Adds Google + GitHub providers" }`,
        res: `{
  "id": "ep-4281",
  "closedAt": "2026-06-30T18:42:11Z"
}`,
      },
      log_ai_call: {
        purpose: 'Record a prompt/response pair inside the active episode.',
        perm: 'workspace:write',
        input: `{
  "type": "object",
  "required": ["prompt", "response"],
  "properties": {
    "prompt": { "type": "string" },
    "response": { "type": "string" },
    "model": { "type": "string" }
  }
}`,
        output: `{ "logged": true, "id": "ai-9821" }`,
        req: `{ "tool": "log_ai_call", "prompt": "Explain auth middleware", "response": "...", "model": "gemini-2.0" }`,
        res: `{ "logged": true, "id": "ai-9821" }`,
      },
      explain_diff: {
        purpose: 'Summarize a git diff in plain English with file-level impact.',
        perm: 'workspace:read · git:read',
        input: `{
  "type": "object",
  "properties": {
    "ref": { "type": "string", "default": "HEAD" }
  }
}`,
        output: `{
  "summary": "Refactors token validation; no behavior change.",
  "files": [{ "path": "src/auth/jwt.ts", "added": 12, "removed": 18 }],
  "risk": "low"
}`,
        req: `{ "tool": "explain_diff", "ref": "HEAD" }`,
        res: `{ "summary": "...", "risk": "low" }`,
      },
      search_context: {
        purpose: 'Semantic search across episodes, diffs, and AI calls.',
        perm: 'workspace:read · embeddings:read',
        input: `{
  "type": "object",
  "required": ["query"],
  "properties": {
    "query": { "type": "string" },
    "limit": { "type": "integer", "default": 8 }
  }
}`,
        output: `{
  "results": [
    { "episodeId": "ep-0419", "score": 0.87, "snippet": "session expiry..." }
  ]
}`,
        req: `{ "tool": "search_context", "query": "authentication bug" }`,
        res: `{ "results": [ ... ] }`,
      },
      get_episode_details: {
        purpose: 'Full payload for a single episode by id.',
        perm: 'workspace:read',
        input: `{
  "type": "object",
  "required": ["id"],
  "properties": { "id": { "type": "string" } }
}`,
        output: `{
  "id": "ep-4281",
  "title": "Ship OAuth",
  "diffs": [...],
  "aiCalls": [...],
  "commits": [...]
}`,
        req: `{ "tool": "get_episode_details", "id": "ep-4281" }`,
        res: `{ "id": "ep-4281", "...": "..." }`,
      },
      get_recent_episodes: {
        purpose: 'List recent episodes for the current workspace.',
        perm: 'workspace:read',
        input: `{
  "type": "object",
  "properties": { "limit": { "type": "integer", "default": 12 } }
}`,
        output: `{
  "episodes": [
    { "id": "ep-4281", "title": "Ship OAuth", "closedAt": "..." }
  ]
}`,
        req: `{ "tool": "get_recent_episodes", "limit": 12 }`,
        res: `{ "episodes": [ ... ] }`,
      },
      explain_past_changes: {
        purpose: 'Natural-language audit of historical changes to a path.',
        perm: 'workspace:read · git:read',
        input: `{
  "type": "object",
  "required": ["path"],
  "properties": { "path": { "type": "string" } }
}`,
        output: `{
  "path": "src/auth/jwt.ts",
  "summary": "Three risk-relevant edits in the last 30 days...",
  "edits": [...]
}`,
        req: `{ "tool": "explain_past_changes", "path": "src/auth/jwt.ts" }`,
        res: `{ "path": "src/auth/jwt.ts", "summary": "..." }`,
      },
      res_workspace_current: {
        purpose: 'Workspace configuration, tracking status, and current active episode information.',
        perm: 'workspace:read',
        input: 'None',
        output: `{\n  "workspace": {\n    "path": "/project",\n    "activeEpisode": "ep-4281",\n    "isSyncEnabled": true\n  }\n}`,
        req: 'GET workspace://current',
        res: `{\n  "workspace": {\n    "path": "/project",\n    "activeEpisode": "ep-4281",\n    "isSyncEnabled": true\n  }\n}`,
      },
      res_git_diff: {
        purpose: 'Full unstaged and staged diff output for the current branch.',
        perm: 'git:read',
        input: 'None',
        output: 'Standard unified git diff text',
        req: 'GET workspace://git-diff',
        res: `diff --git a/src/auth.ts b/src/auth.ts\nindex e69de29..92b5b3a 100644\n--- a/src/auth.ts\n+++ b/src/auth.ts\n...`,
      },
      res_episodes: {
        purpose: 'A text-formatted history log of recent tracking episodes.',
        perm: 'workspace:read',
        input: 'None',
        output: 'List of past episodes with start/end times and summaries',
        req: 'GET workspace://episodes',
        res: `ep-4281: Ship OAuth (2026-06-30T14:18Z - Active)\nep-4280: Fix session cookies (2026-06-29T10:15Z - Closed)`,
      },
      res_diagnostics: {
        purpose: 'List of editor compilation, linting, and formatting markers.',
        perm: 'workspace:read',
        input: 'None',
        output: `[\n  {\n    "severity": "error",\n    "message": "Property 'user' does not exist",\n    "line": 42\n  }\n]`,
        req: 'GET workspace://diagnostics',
        res: `[\n  {\n    "severity": "error",\n    "message": "Property 'user' does not exist",\n    "line": 42\n  }\n]`,
      },
      res_symbols: {
        purpose: 'List of functions, classes, interfaces, and methods in the workspace.',
        perm: 'workspace:read',
        input: 'None',
        output: `[\n  {\n    "name": "AuthMiddleware",\n    "kind": "class",\n    "file": "src/auth.ts"\n  }\n]`,
        req: 'GET workspace://symbols',
        res: `[\n  {\n    "name": "AuthMiddleware",\n    "kind": "class",\n    "file": "src/auth.ts"\n  }\n]`,
      },
      prompt_explain_diff: {
        purpose: 'Guides AI to perform a comprehensive code review focusing on risk assessment.',
        perm: 'workspace:read · git:read',
        input: 'None',
        output: 'System instructions for code review',
        req: 'GET prompt://explain_diff',
        res: 'Act as a senior staff engineer. Review the diff in workspace://git-diff. Identify security flaws, API breaks, and database performance regressions.',
      },
      prompt_review_code: {
        purpose: 'Guides AI to review current edits against the stated active episode goals.',
        perm: 'workspace:read · git:read',
        input: 'None',
        output: 'System instructions to compare diff with episode title',
        req: 'GET prompt://review_code',
        res: 'Compare the current workspace diff in workspace://git-diff with the active episode title in workspace://current. Are they aligned? List any missing requirements.',
      },
      prompt_generate_tests: {
        purpose: 'Guides AI to generate unit and integration tests for modified files.',
        perm: 'workspace:read',
        input: `{ "path": "string" }`,
        output: 'System instruction template for test generation',
        req: 'GET prompt://generate_tests?path=src/auth.ts',
        res: 'Review the contents and exported symbols of src/auth.ts. Write 10 Jest unit tests covering edge cases, invalid inputs, and error-handling paths.',
      },
      prompt_security_audit: {
        purpose: 'Guides AI to perform threat-modeling and security validation.',
        perm: 'workspace:read',
        input: `{ "path": "string" }`,
        output: 'System instructions for threat modeling',
        req: 'GET prompt://security_audit?path=src/auth.ts',
        res: 'Perform a security audit on src/auth.ts. Check for OWASP Top 10 vulnerabilities, input sanitization issues, and cryptographic weaknesses.',
      },
      prompt_summarize_episode: {
        purpose: 'Prompts AI to draft a detailed handoff/close summary of the active episode.',
        perm: 'workspace:read',
        input: 'None',
        output: 'System instruction template to summarize changes',
        req: 'GET prompt://summarize_episode',
        res: 'Summarize the active episode in workspace://current. Read the recorded AI calls and git changes to draft a professional PR description.',
      },
    };

    const detail = document.getElementById('mcp-detail');
    if (!detail) return;
    const closeBtn = document.getElementById('mcp-close');
    closeBtn && closeBtn.addEventListener('click', () => {
      detail.hidden = true;
      if (window.location.hash) {
        history.pushState(null, null, ' ');
      }
    });

    document.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.detail;
        const d = details[key];
        if (!d) return;
        document.getElementById('mcp-detail-name').textContent = key;
        document.getElementById('mcp-detail-purpose').textContent = d.purpose;
        document.getElementById('mcp-detail-perm').textContent = d.perm;
        document.getElementById('mcp-detail-input').textContent = d.input;
        document.getElementById('mcp-detail-output').textContent = d.output;
        document.getElementById('mcp-detail-req').textContent = d.req;
        document.getElementById('mcp-detail-res').textContent = d.res;
        detail.hidden = false;

        // Update URL hash for permalink without scroll jump
        history.pushState(null, null, '#' + key);

        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Check location hash on page load to see if we should jump to a tab or open a detail view
    const urlHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (urlHash === 'resources' || urlHash === 'prompts') {
      switchTab(urlHash);
    } else if (urlHash) {
      const targetBtn = document.querySelector(`[data-detail="${urlHash}"]`);
      if (targetBtn) {
        const table = targetBtn.closest('table');
        if (table) {
          const tabId = table.id === 'mcp-resources' ? 'resources' : (table.id === 'mcp-prompts' ? 'prompts' : 'tools');
          switchTab(tabId);
        }
        setTimeout(() => {
          targetBtn.click();
        }, 150);
      }
    }

    // Wire code tags for copy to clipboard
    document.querySelectorAll('.mcp-table code').forEach(code => {
      code.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = code.textContent.trim();
        navigator.clipboard.writeText(text).then(() => {
          code.classList.add('copied');
          setTimeout(() => {
            code.classList.remove('copied');
          }, 1500);
        });
      });
    });
  }

  /* ---------- ARCHITECTURE LAYER HOVER ---------- */
  function initArchHover() {
    const layers = document.querySelectorAll('.arch__layer');
    layers.forEach(l => {
      l.addEventListener('mouseenter', () => {
        layers.forEach(o => o !== l && (o.style.opacity = '0.4'));
      });
      l.addEventListener('mouseleave', () => {
        layers.forEach(o => o.style.opacity = '');
      });
    });
  }

  /* ---------- DOCS SCROLL SPY ---------- */
  function initDocsScrollSpy() {
    const sidebarLinks = document.querySelectorAll('.docs__sidebar a');
    const tocLinks = document.querySelectorAll('.docs__toc a');
    const sections = document.querySelectorAll('.docs__content section');
    if (!sections.length) return;

    function activeLink(hash) {
      sidebarLinks.forEach(link => {
        const active = link.getAttribute('href') === hash;
        link.classList.toggle('is-active', active);
        if (active) {
          link.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      tocLinks.forEach(link => {
        const active = link.getAttribute('href') === hash;
        link.classList.toggle('is-active', active);
      });
    }

    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          activeLink(`#${id}`);
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // Fallback for invalid location hashes on page load
    if (window.location.hash) {
      try {
        const target = document.querySelector(window.location.hash);
        if (!target && document.querySelector('.docs')) {
          window.location.hash = '#intro';
        }
      } catch (e) {
        if (document.querySelector('.docs')) {
          window.location.hash = '#intro';
        }
      }
    }
  }

  /* ---------- DOCS SEARCH ---------- */
  function initDocsSearch() {
    const search = document.getElementById('docs-search');
    const sections = document.querySelectorAll('.docs__content section');
    const sidebarLinks = document.querySelectorAll('.docs__sidebar a');
    if (!search || !sections.length) return;

    search.addEventListener('input', () => {
      const q = search.value.toLowerCase().trim();
      const terms = q ? q.split(/\s+/) : [];

      sections.forEach(section => {
        const id = section.getAttribute('id');
        const text = section.textContent.toLowerCase();
        const matches = q ? terms.every(term => text.includes(term)) : true;

        // Hide/show matching sidebar links
        sidebarLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.style.display = matches ? 'block' : 'none';
          }
        });
      });
    });
  }

  /* ---------- TIMELINE INTERACTIVE ---------- */
  function initTimelineInteractive() {
    const bar = document.querySelector('.timeline__bar');
    if (!bar) return;
    const items = bar.querySelectorAll('li');
    const title = document.getElementById('timeline-step-title');
    const desc = document.getElementById('timeline-step-desc');
    const contentBox = document.querySelector('.timeline__content');
    if (!items.length || !title || !desc) return;

    const data = {
      start: {
        title: 'Start Episode',
        desc: 'AI client or CLI runs <code>contextlens start</code>. A new tracking session is initialized in your local SQLite database.'
      },
      code: {
        title: 'Code Watching',
        desc: 'Editor watchers track file changes, text edits, active documents, and terminal commands in real-time.'
      },
      git: {
        title: 'Git Integration',
        desc: 'Git integrations automatically associate commits, branch names, and PR drafts with the active episode.'
      },
      ai: {
        title: 'AI Logs Capture',
        desc: 'Any prompts, answers, and context requests made to Claude, Cursor, or Gemini are logged inside the episode.'
      },
      snap: {
        title: 'Workspace Snapshots',
        desc: 'On code save or test runs, a snapshot of the workspace diagnostics and code symbols is cached locally.'
      },
      review: {
        title: 'Interactive Review',
        desc: 'Run security audits, review diffs, or generate unit tests against the captured episode intent.'
      },
      close: {
        title: 'Close & Sync',
        desc: 'Run <code>contextlens close</code> to archive the episode, summarize its changes, and sync metadata (optional) to Firebase.'
      }
    };

    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        const step = item.dataset.step;
        if (!data[step]) return;
        
        // Update active class
        items.forEach(i => i.classList.remove('is-active'));
        item.classList.add('is-active');

        // Transition content box opacity
        contentBox.style.opacity = '0.3';
        setTimeout(() => {
          title.textContent = data[step].title;
          desc.innerHTML = data[step].desc;
          contentBox.style.opacity = '1';
        }, 100);
      });
    });
  }

  /* ---------- DOCS COLLAPSIBLE GROUPS ---------- */
  function initDocsCollapse() {
    const headers = document.querySelectorAll('.docs__group h6');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        const group = h.closest('.docs__group');
        if (group) {
          group.classList.toggle('is-collapsed');
        }
      });
    });
  }

  /* ---------- MOBILE MENU ---------- */
  function initMobileMenu() {
    const toggle = document.querySelector('.nav__toggle');
    const navLinks = document.querySelector('.nav-links');
    const header = document.querySelector('.nav');
    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', !isOpen);
      navLinks.classList.toggle('is-open');
      header.classList.toggle('is-open');
    });

    // Close menu when clicking link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- BOOT ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initHeroCanvas();
    initTerminal();
    initMcp();
    initArchHover();
    initDocsScrollSpy();
    initDocsSearch();
    initDocsCollapse();
    initTimelineInteractive();
    initMobileMenu();
  });
})();
