function getDashboardHTML() {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Webhook Monitor</title>
<meta name="theme-color" content="#0969da">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GH Webhook">
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/favicon-192.png">
<link rel="manifest" href="/manifest.json">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9}
a{color:#58a6ff;text-decoration:none} a:hover{text-decoration:underline}
.topbar{background:linear-gradient(135deg,#023e6b,#0077b6,#00b4d8);padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:10}
.topbar h1{font-size:18px;color:#fff;font-weight:600}
.topbar .status{margin-left:auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.green{background:#3fb950}.dot.red{background:#f85149}.dot.amber{background:#d29922}
.badge{background:rgba(255,255,255,.15);color:#fff;padding:2px 10px;border-radius:12px;font-size:13px}
.container{max-width:1400px;margin:0 auto;padding:20px}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:16px}
.panel h2{font-size:15px;color:#58a6ff;margin-bottom:12px}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.summary-card{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px}
.summary-card .label{font-size:11px;color:#8b949e;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.summary-card .value{font-size:22px;font-weight:600}
.repo-card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px;margin-bottom:18px}
.repo-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
.repo-title{font-size:18px;font-weight:600}
.repo-meta{display:flex;gap:8px;flex-wrap:wrap}
.status-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.badge-clean{background:#238636;color:#fff}.badge-passing{background:#238636;color:#fff}.badge-pending{background:#d29922;color:#111}.badge-failed{background:#f85149;color:#fff}.badge-approved{background:#238636;color:#fff}.badge-changes{background:#f85149;color:#fff}.badge-conflict{background:#f85149;color:#fff}.badge-draft{background:#d29922;color:#111}
.section-title{font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px}
.item-list{display:flex;flex-direction:column;gap:10px}
.item-card{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px}
.item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}
.item-title{font-size:14px;font-weight:600}
.item-sub{font-size:12px;color:#8b949e;margin-top:4px}
.item-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.item-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:10px}
.fact{background:#11161d;border:1px solid #222b36;border-radius:6px;padding:8px}
.fact .k{font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.fact .v{font-size:13px}
.history-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.history-item{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;background:#11161d;border:1px solid #222b36;border-radius:6px;padding:8px}
.history-item .meta{font-size:11px;color:#8b949e}
button{background:#238636;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px}
button:hover{background:#2ea043}
button.secondary{background:#30363d;color:#c9d1d9}
button.secondary:hover{background:#3b424c}
.toggle-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.empty{color:#484f58;font-style:italic;padding:14px;text-align:center}
pre.log{background:#0d1117;padding:12px;border-radius:6px;font-size:11px;max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:'SF Mono',Consolas,monospace;line-height:1.4}
textarea.json-editor{width:100%;min-height:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;padding:12px;font-size:12px;font-family:'SF Mono',Consolas,monospace;line-height:1.5;resize:vertical}
#jobDetailPanel{position:sticky;bottom:0;z-index:9}
.hint{color:#8b949e;font-size:12px}
@media (max-width: 800px){.container{padding:12px}.topbar{padding:10px 12px}.repo-head,.item-head,.toggle-row{flex-direction:column;align-items:flex-start}}
</style></head><body>
<div class="topbar">
  <img src="/logo.svg" alt="GitHub Webhook Monitor" style="height:28px;width:auto;filter:brightness(0) invert(1)">
  <h1>Webhook Monitor</h1>
  <div class="status">
    <span class="dot amber" id="connDot"></span>
    <span class="badge" id="connLabel">connecting</span>
    <span class="badge" id="generatedAt">-</span>
  </div>
</div>
<div class="container">
  <div class="panel">
    <div class="toggle-row">
      <div>
        <h2>Live Operations Board</h2>
        <div class="hint">Actionable PRs and monitor-relevant issues grouped by repository. Updates stream over WebSocket without page refresh.</div>
      </div>
      <label class="hint"><input type="checkbox" id="showAllToggle"> Show non-actionable</label>
    </div>
    <div class="summary-grid" id="summaryGrid" style="margin-top:12px"></div>
  </div>
  <div id="configSection" class="panel">
    <div class="toggle-row">
      <div>
        <h2>Configuration</h2>
        <div class="hint">Manage repositories, agents, prompts, and key settings without editing raw JSON.</div>
      </div>
      <button class="secondary" data-action="reloadConfigPanel">Reload config</button>
    </div>
    <div id="configStatus" class="hint" style="margin-top:10px">idle</div>
    <div id="configPanel" style="margin-top:14px"></div>
  </div>
  <div id="jobDetailPanel" class="panel" style="display:none">
    <h2>Log / Output</h2>
    <div class="hint" id="jobDetailMeta"></div>
    <div class="item-row" id="jobDetailActions" style="margin-top:10px;margin-bottom:10px"></div>
    <pre class="log" id="jobDetailOut"></pre>
  </div>
  <div id="liveBoard"></div>
</div>
<script>
const $ = (s) => document.querySelector(s);
const state = { snapshot: null, selectedDetail: null, showAll: false, ws: null, reconnectTimer: null, config: null };

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  return await res.json();
}

function esc(s){ const d=document.createElement('div'); d.textContent=String(s ?? ''); return d.innerHTML; }
function fmtMinutes(mins){ if(mins==null) return 'unknown'; if(mins<60) return mins+'m'; const h=Math.floor(mins/60); const m=mins%60; if(h<24) return h+'h '+m+'m'; const d=Math.floor(h/24); return d+'d '+(h%24)+'h'; }

function setConnection(status) {
  const dot = $('#connDot');
  const label = $('#connLabel');
  if (!dot || !label) return;
  if (status === 'live') { dot.className = 'dot green'; label.textContent = 'live'; }
  else if (status === 'reconnecting') { dot.className = 'dot amber'; label.textContent = 'reconnecting'; }
  else { dot.className = 'dot red'; label.textContent = status; }
}

function getRepositories() {
  return state.snapshot?.repositories || [];
}

function getVisiblePrs(repo) {
  if (!repo) return [];
  return state.showAll ? (repo.allPrs || repo.prs || []) : (repo.prs || []);
}

function getVisibleIssues(repo) {
  if (!repo) return [];
  return state.showAll ? (repo.allIssues || repo.issues || []) : (repo.issues || []);
}

function renderSummary() {
  const el = $('#summaryGrid');
  if (!el) return;
  const repos = getRepositories().filter((repo) => state.showAll || (repo.summary.actionablePrs + repo.summary.actionableIssues) > 0);
  const actionableRepos = repos.filter((repo) => (repo.summary.actionablePrs + repo.summary.actionableIssues) > 0);
  const totalActionablePrs = repos.reduce((n, repo) => n + (repo.summary.actionablePrs || 0), 0);
  const totalActionableIssues = repos.reduce((n, repo) => n + (repo.summary.actionableIssues || 0), 0);
  const totalActiveJobs = repos.reduce((n, repo) => n + (repo.summary.activeJobs || 0), 0);
  const cards = [
    ['Repositories', actionableRepos.length],
    ['Actionable PRs', totalActionablePrs],
    ['Actionable Issues', totalActionableIssues],
    ['Active Jobs', totalActiveJobs],
  ];
  el.innerHTML = cards.map(([label, value]) => '<div class="summary-card"><div class="label">'+esc(label)+'</div><div class="value">'+esc(value)+'</div></div>').join('');
}

function renderHistoryItem(job) {
  const logBtn = '<button class="secondary" data-action="openJobDetail" data-mode="log" data-jobkey="'+esc(job.key)+'">Log</button>';
  const outBtn = '<button class="secondary" data-action="openJobDetail" data-mode="output" data-jobkey="'+esc(job.key)+'">Output</button>';
  return '<div class="history-item"><div><div><strong>'+esc(job.key)+'</strong></div><div class="meta">'+esc(job.agentType||'agent')+' · exit '+esc(job.code)+' · '+esc(job.duration)+' · '+esc(job.startTime)+'</div></div><div class="item-row">'+logBtn+outBtn+'</div></div>';
}

function renderPrCard(pr) {
  const badges = [
    '<span class="status-badge '+(pr.mergeable===false?'badge-conflict':pr.mergeable===true?'badge-clean':'badge-pending')+'">'+esc(pr.mergeable===false?'CONFLICT':pr.mergeable===true?'CLEAN':'UNKNOWN')+'</span>',
    '<span class="status-badge '+(pr.ciStatus==='passing'?'badge-passing':pr.ciStatus==='failed'?'badge-failed':'badge-pending')+'">CI '+esc((pr.ciStatus||'unknown').toUpperCase())+'</span>',
    '<span class="status-badge '+(pr.reviewState==='approved'?'badge-approved':pr.reviewState==='changes_requested'?'badge-changes':'badge-pending')+'">'+esc((pr.reviewState||'pending').toUpperCase())+'</span>'
  ];
  const jobs = (pr.jobs || []).length ? '<div class="history-list">'+pr.jobs.map(renderHistoryItem).join('')+'</div>' : '<div class="empty">No jobs yet</div>';
  const blockers = (pr.blockers||[]).map((b) => '<div class="fact"><div class="k">Blocker</div><div class="v">'+esc(b.message)+'</div></div>').join('');
  return '<div class="item-card">'
    + '<div class="item-head"><div><div class="item-title"><a href="https://github.com/'+esc(pr.repo)+'/pull/'+esc(pr.prNumber)+'" target="_blank">#'+esc(pr.prNumber)+' '+esc(pr.title)+'</a></div><div class="item-sub">base '+esc(pr.branch||'unknown')+'</div></div><div class="item-row">'+badges.join('')+'</div></div>'
    + '<div class="item-grid">'
    + '<div class="fact"><div class="k">PR Age</div><div class="v">'+esc(fmtMinutes(pr.prAgeMinutes))+'</div></div>'
    + '<div class="fact"><div class="k">Iterations</div><div class="v">'+esc(pr.iterationCount || 0)+'</div></div>'
    + '<div class="fact"><div class="k">Waiting For</div><div class="v">'+esc(pr.waitingFor || 'Unknown')+'</div></div>'
    + '<div class="fact"><div class="k">Last Updated</div><div class="v">'+esc(pr.lastUpdated || 'unknown')+'</div></div>'
    + blockers
    + '</div>'
    + '<div class="section-title">Recent Jobs / Actions</div>'
    + jobs
    + '</div>';
}

function renderIssueCard(issue) {
  const labels = (issue.labels||[]).map((label) => '<span class="status-badge badge-pending">'+esc(label)+'</span>').join('');
  const jobs = (issue.jobs || []).length ? '<div class="history-list">'+issue.jobs.map(renderHistoryItem).join('')+'</div>' : '<div class="empty">No jobs yet</div>';
  return '<div class="item-card">'
    + '<div class="item-head"><div><div class="item-title"><a href="https://github.com/'+esc(issue.repo)+'/issues/'+esc(issue.number)+'" target="_blank">#'+esc(issue.number)+' '+esc(issue.title)+'</a></div><div class="item-sub">'+esc(issue.state||'open')+'</div></div><div class="item-row">'+labels+'</div></div>'
    + '<div class="item-grid">'
    + '<div class="fact"><div class="k">Issue Age</div><div class="v">'+esc(fmtMinutes(issue.issueAgeMinutes))+'</div></div>'
    + '<div class="fact"><div class="k">Iterations</div><div class="v">'+esc(issue.iterationCount || 0)+'</div></div>'
    + '</div>'
    + '<div class="section-title">Recent Jobs / Actions</div>'
    + jobs
    + '</div>';
}

function renderBoard() {
  renderSummary();
  const board = $('#liveBoard');
  if (!board) return;
  const repos = getRepositories();
  if (!repos.length) {
    board.innerHTML = '<div class="panel"><div class="empty">No monitored repositories</div></div>';
    return;
  }
  board.innerHTML = repos.map((repo) => {
    const prs = getVisiblePrs(repo);
    const issues = getVisibleIssues(repo);
    return '<div class="repo-card">'
      + '<div class="repo-head"><div><div class="repo-title">'+esc(repo.repo)+'</div><div class="hint">'+esc(repo.summary.actionablePrs)+' actionable PRs · '+esc(repo.summary.actionableIssues)+' actionable issues · '+esc(repo.summary.activeJobs)+' active jobs</div></div>'
      + '<div class="repo-meta">'
      + (repo.summary.hiddenPrs ? '<span class="status-badge badge-pending">'+esc(repo.summary.hiddenPrs)+' hidden PRs</span>' : '')
      + (repo.summary.hiddenIssues ? '<span class="status-badge badge-pending">'+esc(repo.summary.hiddenIssues)+' hidden issues</span>' : '')
      + '</div></div>'
      + '<div class="section-title">Pull Requests</div>'
      + (prs.length ? '<div class="item-list">'+prs.map(renderPrCard).join('')+'</div>' : '<div class="empty">No '+(state.showAll ? '' : 'actionable ')+'PRs</div>')
      + '<div class="section-title">Issues</div>'
      + (issues.length ? '<div class="item-list">'+issues.map(renderIssueCard).join('')+'</div>' : '<div class="empty">No '+(state.showAll ? '' : 'actionable ')+'issues</div>')
      + '</div>';
  }).join('');
  renderJobDetail();
  $('#generatedAt').textContent = state.snapshot?.generatedAt || '-';
}

function findJobByKey(jobKey) {
  for (const repo of getRepositories()) {
    for (const pr of (repo.allPrs || [])) {
      const job = (pr.jobs || []).find((j) => j.key === jobKey);
      if (job) return job;
    }
    for (const issue of (repo.allIssues || [])) {
      const job = (issue.jobs || []).find((j) => j.key === jobKey);
      if (job) return job;
    }
  }
  return null;
}

async function renderJobDetail() {
  const panel = $('#jobDetailPanel');
  const meta = $('#jobDetailMeta');
  const out = $('#jobDetailOut');
  const actions = $('#jobDetailActions');
  if (!panel || !meta || !out || !actions) return;
  if (!state.selectedDetail?.jobKey) {
    panel.style.display = 'none';
    return;
  }
  const job = findJobByKey(state.selectedDetail.jobKey);
  if (!job) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const isLog = state.selectedDetail.mode === 'log';
  meta.textContent = isLog ? ('Absolute log path: ' + (job.logFile || '(missing)')) : ('Captured output for: ' + job.key);
  actions.innerHTML = '<button class="secondary" data-action="closeDetail">Close</button>';
  if (isLog) {
    try {
      const filename = (job.logFile || '').split('/').pop();
      const r = await fetch('/api/logs/' + encodeURIComponent(filename));
      out.textContent = await r.text();
    } catch (e) {
      out.textContent = 'Error loading log: ' + e.message;
    }
  } else {
    out.textContent = job.outputTail || '(no output recorded)';
  }
}

async function loadSnapshot() {
  const resp = await fetchJson('/api/dashboard');
  state.snapshot = resp.snapshot;
  renderBoard();
}

function checked(v){ return v ? ' checked' : ''; }
function selected(current, value){ return current === value ? ' selected' : ''; }

function renderConfigPanel() {
  const root = $('#configPanel');
  const cfg = state.config;
  if (!root) return;
  if (!cfg) {
    root.innerHTML = '<div class="empty">Loading config…</div>';
    return;
  }
  const repos = Object.entries(cfg.repos || {}).map(([name, repo]) =>
    '<tr><td class="item-sub">'+esc(name)+'</td><td class="item-sub">'+esc(repo.localPath)+'</td><td><input type="checkbox" data-role="repo-enabled" data-repo="'+esc(name)+'"'+checked(repo.enabled)+'</td><td><button class="secondary" data-action="removeRepoBtn" data-repo="'+esc(name)+'">Remove</button></td></tr>'
  ).join('');
  const promptRows = Object.entries(cfg.promptTemplates || {}).map(([key, value]) =>
    '<div class="fact" style="grid-column:1/-1"><div class="k">'+esc(key)+'</div><textarea class="json-editor" style="min-height:120px" data-role="prompt" data-key="'+esc(key)+'">'+esc(value)+'</textarea></div>'
  ).join('');
  const repoOverrideRows = Object.keys(cfg.repos || {}).map((name) => {
    const current = cfg.agentConfig?.perRepoOverride?.[name] || '';
    return '<tr><td class="item-sub">'+esc(name)+'</td><td><select data-role="repo-agent" data-repo="'+esc(name)+'"><option value=""'+selected(current, '')+'>Default</option><option value="claude"'+selected(current, 'claude')+'>Claude</option><option value="codex"'+selected(current, 'codex')+'>Codex</option></select></td></tr>';
  }).join('');

  root.innerHTML =
    '<div class="section-title">Repositories</div>'
    + '<div class="item-card"><table style="width:100%"><tr><th>Name</th><th>Local Path</th><th>Enabled</th><th></th></tr>'+repos+'</table>'
    + '<div class="item-row" style="margin-top:12px"><input id="newRepoName" placeholder="owner/repo"><input id="newRepoPath" placeholder="/path/to/checkout" style="min-width:320px"><button data-action="addRepoBtn">Add repository</button><button data-action="saveRepos">Save repository states</button></div></div>'
    + '<div class="section-title">Agents</div>'
    + '<div class="item-card"><div class="item-grid">'
    + '<div class="fact"><div class="k">Default Agent</div><div class="v"><select id="defaultAgentSelect"><option value="claude"'+selected(cfg.agentConfig?.defaultAgent,'claude')+'>Claude</option><option value="codex"'+selected(cfg.agentConfig?.defaultAgent,'codex')+'>Codex</option></select></div></div>'
    + '<div class="fact"><div class="k">Codex Model</div><div class="v"><input id="codexModelInput" value="'+esc(cfg.agent?.codex?.model || '')+'"></div></div>'
    + '<div class="fact"><div class="k">Codex Sandbox</div><div class="v"><select id="codexSandboxSelect"><option value="read-only"'+selected(cfg.agent?.codex?.sandbox,'read-only')+'>read-only</option><option value="workspace-write"'+selected(cfg.agent?.codex?.sandbox,'workspace-write')+'>workspace-write</option><option value="danger-full-access"'+selected(cfg.agent?.codex?.sandbox,'danger-full-access')+'>danger-full-access</option></select></div></div>'
    + '<div class="fact"><div class="k">Codex Extra Args</div><div class="v"><input id="codexExtraArgsInput" value="'+esc(cfg.agent?.codex?.extraArgs || '')+'"></div></div>'
    + '<div class="fact"><div class="k">Claude Model</div><div class="v"><input id="claudeModelInput" value="'+esc(cfg.agent?.claude?.model || '')+'"></div></div>'
    + '</div><div class="section-title">Per-repository overrides</div><table style="width:100%"><tr><th>Repository</th><th>Agent</th></tr>'+repoOverrideRows+'</table><div class="item-row" style="margin-top:12px"><button data-action="saveDefaultAgent">Save default agent</button><button data-action="saveAgentSettings">Save agent settings</button><button data-action="saveRepoAgents">Save repo overrides</button></div></div>'
    + '<div class="section-title">Prompts</div>'
    + '<div class="item-card"><div class="item-grid">'+promptRows+'</div><div class="item-row" style="margin-top:12px"><button data-action="savePrompts">Save prompts</button></div></div>'
    + '<div class="section-title">Settings</div>'
    + '<div class="item-card"><div class="item-grid">'
    + '<div class="fact"><div class="k">Max concurrent jobs</div><div class="v"><input id="maxJobsInput" type="number" min="1" value="'+esc(cfg.settings?.maxConcurrentJobs ?? 1)+'"></div></div>'
    + '<div class="fact"><div class="k">Job timeout minutes</div><div class="v"><input id="timeoutInput" type="number" min="1" value="'+esc(cfg.settings?.jobTimeoutMinutes ?? 15)+'"></div></div>'
    + '<div class="fact"><div class="k">Bot username</div><div class="v"><input id="botUsernameInput" value="'+esc(cfg.settings?.botUsername || '')+'"></div></div>'
    + '<div class="fact"><div class="k">In-progress label</div><div class="v"><input id="inProgressLabelInput" value="'+esc(cfg.settings?.inProgressLabel || '')+'"></div></div>'
    + '<div class="fact"><div class="k">Resolved label</div><div class="v"><input id="resolvedLabelInput" value="'+esc(cfg.settings?.agentResolvedLabel || '')+'"></div></div>'
    + '<div class="fact"><div class="k">Trigger keywords</div><div class="v"><input id="triggerKeywordsInput" value="'+esc((cfg.settings?.triggerKeywords || []).join(', '))+'"></div></div>'
    + '<div class="fact"><div class="k">Issue labels</div><div class="v"><input id="issueLabelsInput" value="'+esc((cfg.settings?.issueLabels || []).join(', '))+'"></div></div>'
    + '<div class="fact"><div class="k">Ignored bots</div><div class="v"><input id="ignoredBotsInput" value="'+esc((cfg.settings?.ignoredBots || []).join(', '))+'"></div></div>'
    + '</div><div class="item-row" style="margin-top:12px"><button data-action="saveSettingsPanel">Save settings</button></div></div>';
}

async function loadConfigPanel() {
  const status = $('#configStatus');
  if (status) status.textContent = 'loading';
  state.config = await fetchJson('/api/config');
  renderConfigPanel();
  if (status) status.textContent = 'loaded';
}

function csvValue(id) {
  const v = ($(id)?.value || '').trim();
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function connectWebSocket() {
  if (state.ws) state.ws.close();
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(protocol + '//' + location.host + '/ws');
  state.ws.onopen = () => setConnection('live');
  state.ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'snapshot') {
        state.snapshot = message.snapshot;
        renderBoard();
      }
    } catch (e) {
      console.error(e);
    }
  };
  state.ws.onclose = () => {
    setConnection('reconnecting');
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(connectWebSocket, 1500);
  };
  state.ws.onerror = () => setConnection('error');
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'showAllToggle') {
    state.showAll = e.target.checked;
    renderBoard();
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action === 'openJobDetail') {
    state.selectedDetail = { jobKey: btn.getAttribute('data-jobkey'), mode: btn.getAttribute('data-mode') };
    await renderJobDetail();
    $('#jobDetailPanel')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  } else if (action === 'closeDetail') {
    state.selectedDetail = null;
    renderJobDetail();
  } else if (action === 'reloadConfigPanel') {
    await loadConfigPanel();
  } else if (action === 'addRepoBtn') {
    const name = $('#newRepoName')?.value?.trim();
    const localPath = $('#newRepoPath')?.value?.trim();
    if (name && localPath) {
      await fetchJson('/api/repos', { method: 'POST', body: JSON.stringify({ name, localPath, enabled: true }) });
      await loadConfigPanel();
      await loadSnapshot();
    }
  } else if (action === 'removeRepoBtn') {
    const repo = btn.getAttribute('data-repo');
    if (repo) {
      const [owner, repoName] = repo.split('/');
      await fetch('/api/repos/'+owner+'/'+repoName, { method: 'DELETE' });
      await loadConfigPanel();
      await loadSnapshot();
    }
  } else if (action === 'saveRepos') {
    const nextRepos = structuredClone(state.config.repos || {});
    document.querySelectorAll('[data-role="repo-enabled"]').forEach((el) => {
      const repo = el.getAttribute('data-repo');
      if (nextRepos[repo]) nextRepos[repo].enabled = el.checked;
    });
    await fetchJson('/api/config', { method: 'POST', body: JSON.stringify({ repos: nextRepos }) });
    await loadConfigPanel();
    await loadSnapshot();
  } else if (action === 'saveDefaultAgent') {
    await fetchJson('/api/agent', { method: 'POST', body: JSON.stringify({ defaultAgent: $('#defaultAgentSelect')?.value }) });
    await loadConfigPanel();
  } else if (action === 'saveAgentSettings') {
    await fetchJson('/api/agent', { method: 'POST', body: JSON.stringify({ codex: { model: $('#codexModelInput')?.value, sandbox: $('#codexSandboxSelect')?.value, extraArgs: $('#codexExtraArgsInput')?.value }, claude: { model: $('#claudeModelInput')?.value } }) });
    await loadConfigPanel();
  } else if (action === 'saveRepoAgents') {
    const overrides = document.querySelectorAll('[data-role="repo-agent"]');
    for (const el of overrides) {
      const repo = el.getAttribute('data-repo');
      const [owner, repoName] = repo.split('/');
      await fetchJson('/api/repos/'+owner+'/'+repoName+'/agent', { method: 'POST', body: JSON.stringify({ agent: el.value || null }) });
    }
    await loadConfigPanel();
  } else if (action === 'savePrompts') {
    const body = {};
    document.querySelectorAll('[data-role="prompt"]').forEach((el) => {
      body[el.getAttribute('data-key')] = el.value;
    });
    await fetchJson('/api/prompts', { method: 'POST', body: JSON.stringify(body) });
    await loadConfigPanel();
  } else if (action === 'saveSettingsPanel') {
    await fetchJson('/api/settings', { method: 'POST', body: JSON.stringify({
      maxConcurrentJobs: Number($('#maxJobsInput')?.value || 1),
      jobTimeoutMinutes: Number($('#timeoutInput')?.value || 15),
      botUsername: $('#botUsernameInput')?.value || '',
      inProgressLabel: $('#inProgressLabelInput')?.value || '',
      agentResolvedLabel: $('#resolvedLabelInput')?.value || '',
      triggerKeywords: csvValue('#triggerKeywordsInput'),
      issueLabels: csvValue('#issueLabelsInput'),
      ignoredBots: csvValue('#ignoredBotsInput'),
    })});
    await loadConfigPanel();
  }
});

Promise.all([loadSnapshot(), loadConfigPanel()]).then(connectWebSocket).catch((err) => {
  setConnection('error');
  console.error(err);
});
</script></body></html>`;
}

export { getDashboardHTML };
