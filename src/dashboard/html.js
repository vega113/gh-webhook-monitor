function formatDashboardTimestamp(value, options = {}) {
  const fallback = options.fallback ?? "-";
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const formatterOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  };

  return new Intl.DateTimeFormat(options.locale, formatterOptions).format(date);
}

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
.topbar{background:linear-gradient(135deg,#023e6b,#0077b6,#00b4d8);padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:30}
.topbar h1{font-size:18px;color:#fff;font-weight:600}.topbar .status{margin-left:auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot.green{background:#3fb950}.dot.red{background:#f85149}.dot.amber{background:#d29922}
.badge{background:rgba(255,255,255,.15);color:#fff;padding:2px 10px;border-radius:12px;font-size:13px}
.container{max-width:1600px;margin:0 auto;padding:20px}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:16px}
.panel h2{font-size:15px;color:#58a6ff;margin-bottom:12px}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.summary-card{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px}.summary-card .label{font-size:11px;color:#8b949e;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}.summary-card .value{font-size:22px;font-weight:600}
button{background:#238636;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px}
button:hover{background:#2ea043}button.secondary{background:#30363d;color:#c9d1d9}button.secondary:hover{background:#3b424c}button.warn{background:#8957e5}button.warn:hover{background:#9e6ff0}
button:disabled{opacity:.5;cursor:not-allowed}
.toggle-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.hint{color:#8b949e;font-size:12px}.empty{color:#484f58;font-style:italic;padding:14px;text-align:center}
.status-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px}.badge-clean{background:#238636;color:#fff}.badge-passing{background:#238636;color:#fff}.badge-pending{background:#d29922;color:#111}.badge-failed{background:#f85149;color:#fff}.badge-approved{background:#238636;color:#fff}.badge-changes{background:#f85149;color:#fff}.badge-conflict{background:#f85149;color:#fff}.badge-neutral{background:#6e7681;color:#fff}.badge-paused{background:#9e6a03;color:#111}
.repo-group{background:#161b22;border:1px solid #30363d;border-radius:10px;margin-bottom:18px;overflow:hidden}
.repo-row{display:grid;grid-template-columns:minmax(260px,2fr) repeat(4,minmax(100px,1fr)) auto;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid #222b36}
.repo-row button{justify-self:start}.repo-cell .label{font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.repo-cell .value{font-size:13px}
.repo-name{font-size:18px;font-weight:600}.repo-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px 16px;border-bottom:1px solid #222b36;background:#11161d}
.repo-toolbar input,.repo-toolbar select,.repo-toolbar label{font-size:12px}.repo-toolbar input,.repo-toolbar select{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:6px 8px}
.repo-scroll{max-height:520px;overflow:auto}.repo-scroll table{width:100%;border-collapse:collapse;table-layout:fixed}.repo-scroll thead th{position:sticky;top:0;z-index:5;background:#11161d;color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:10px 8px;border-bottom:1px solid #222b36;text-align:left}
.repo-scroll tbody td{padding:10px 8px;border-bottom:1px solid #1f2730;vertical-align:top;font-size:12px}.pr-table tr.pr-row:hover td{background:#11161d}.pr-title{font-size:13px;font-weight:600;display:block;margin-bottom:4px}.pr-sub{font-size:11px;color:#8b949e}
.pr-detail-row td{background:#0f141b;padding:0}.pr-detail-panel{padding:16px;display:flex;flex-direction:column;gap:14px}.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.detail-card{background:#11161d;border:1px solid #222b36;border-radius:8px;padding:10px}.detail-card .k{font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.detail-card .v{font-size:13px}
.inline-jobs{display:flex;flex-direction:column;gap:8px}.history-item{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;background:#11161d;border:1px solid #222b36;border-radius:6px;padding:8px}.history-item .meta{font-size:11px;color:#8b949e}
.inline-output{background:#0d1117;padding:12px;border-radius:6px;border:1px solid #222b36;font-size:11px;max-height:360px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:'SF Mono',Consolas,monospace;line-height:1.4}
.issue-section{padding:0 16px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid #222b36;background:#11161d}
.issue-section-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px}
.issue-section-header .hint{font-size:12px}
.issue-list{display:flex;flex-direction:column;gap:10px}
.issue-item{background:#0f141b;border:1px solid #222b36;border-radius:10px;overflow:hidden}
.issue-item[open]{box-shadow:0 0 0 1px rgba(88,166,255,.12) inset}
.issue-item summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(240px,2fr) repeat(4,minmax(100px,1fr));gap:12px;align-items:center;padding:12px 14px}
.issue-item summary::-webkit-details-marker{display:none}
.issue-item summary .issue-title{font-weight:600;font-size:13px}
.issue-item summary .issue-sub{font-size:11px;color:#8b949e}
.issue-detail-panel{padding:14px;display:flex;flex-direction:column;gap:14px;border-top:1px solid #222b36}
.detail-modal-overlay{position:fixed;inset:0;z-index:50;background:rgba(13,17,23,.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
.detail-modal{width:min(1100px,100%);max-height:min(85vh,900px);background:#161b22;border:1px solid #30363d;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden}
.detail-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #222b36;background:#11161d}
.detail-modal-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.detail-modal-title{font-size:16px;font-weight:600;line-height:1.3;color:#fff}
.detail-modal-subtitle{margin-top:4px;font-size:12px;color:#8b949e}
.detail-modal-close{background:#30363d;color:#c9d1d9;border:none;border-radius:999px;width:32px;height:32px;line-height:32px;font-size:18px;flex:0 0 auto}
.detail-modal-close:hover{background:#3b424c}
.detail-modal-body{padding:16px;overflow:auto;flex:1}
.detail-modal-pre{background:#0d1117;padding:14px;border-radius:10px;border:1px solid #222b36;font-size:12px;max-height:none;min-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:'SF Mono',Consolas,monospace;line-height:1.5}
.detail-modal-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.detail-modal-chip{padding:2px 8px;border-radius:999px;background:#0d1117;border:1px solid #30363d;font-size:11px;color:#c9d1d9}
.polling-countdown{font-variant-numeric:tabular-nums}
.action-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.repo-scroll-sentinel{height:1px}.hidden{display:none}textarea.json-editor{width:100%;min-height:280px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:8px;padding:12px;font-size:12px;font-family:'SF Mono',Consolas,monospace;line-height:1.5;resize:vertical}
@media (max-width: 1100px){.repo-row{grid-template-columns:1fr 1fr;}.repo-scroll{max-height:none}.repo-scroll table,.repo-scroll thead,.repo-scroll tbody,.repo-scroll tr,.repo-scroll th,.repo-scroll td{display:block;width:100%}.repo-scroll thead{display:none}.repo-scroll tbody td{padding:8px 12px}.pr-row{border-bottom:1px solid #1f2730}}
@media (max-width: 800px){.container{padding:12px}.topbar{padding:10px 12px}.toggle-row{flex-direction:column;align-items:flex-start}}
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
        <div class="hint">Repo-grouped PR operations table with inline controls and local state updates over WebSocket.</div>
      </div>
      <label class="hint"><input type="checkbox" id="showAllToggle"> Show non-actionable</label>
    </div>
    <div class="summary-grid" id="summaryGrid" style="margin-top:12px"></div>
  </div>
  <div id="liveBoard"></div>
  <details id="configSection" class="panel">
    <summary style="cursor:pointer;font-weight:600;color:#58a6ff">Configuration</summary>
    <div class="toggle-row" style="margin-top:12px">
      <div class="hint">Manage repositories, agents, prompts, and key settings without editing raw JSON.</div>
      <button class="secondary" data-action="reloadConfigPanel">Reload config</button>
    </div>
    <div id="configStatus" class="hint" style="margin-top:10px">idle</div>
    <div id="configPanel" style="margin-top:14px"></div>
  </details>
</div>
<div id="detailModal" class="detail-modal-overlay hidden" aria-hidden="true">
  <div class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detailModalTitle">
    <div class="detail-modal-header">
      <div>
        <div id="detailModalTitle" class="detail-modal-title">Job detail</div>
        <div id="detailModalSubtitle" class="detail-modal-subtitle">-</div>
      </div>
      <div class="detail-modal-actions">
        <button class="secondary" data-action="copyDetailModalContent" id="detailModalCopyButton">Copy</button>
        <button class="detail-modal-close" data-action="closeDetailModal" aria-label="Close detail modal">×</button>
      </div>
    </div>
    <div id="detailModalBody" class="detail-modal-body"></div>
  </div>
</div>
<script>
const $ = (s) => document.querySelector(s);
const state = { snapshot: null, showAll: false, ws: null, reconnectTimer: null, countdownTimer: null, config: null, repoUi: {}, detailModal: null };
const formatDashboardTimestamp = ${formatDashboardTimestamp.toString()};
let repoInfiniteObserver = null;

async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || ('HTTP ' + res.status));
  }
  return await res.json();
}

function esc(s){ const d=document.createElement('div'); d.textContent=String(s ?? ''); return d.innerHTML; }
function fmtMinutes(mins){ if(mins==null) return 'unknown'; if(mins<60) return mins+'m'; const h=Math.floor(mins/60); const m=mins%60; if(h<24) return h+'h '+m+'m'; const d=Math.floor(h/24); return d+'d '+(h%24)+'h'; }
function formatCountdownLabel(targetIso, fallback = '-') {
  if (!targetIso) return fallback;
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return fallback;
  const remaining = Math.max(0, targetMs - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) return minutes + 'm ' + restSeconds + 's';
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return hours + 'h ' + restMinutes + 'm';
}
function renderCountdownSpan(targetIso, fallback = '-') {
  return '<span class="polling-countdown" data-role="nextPollCountdown" data-next-poll-at="'+esc(targetIso || '')+'">'+esc(formatCountdownLabel(targetIso, fallback))+'</span>';
}
function updateCountdowns() {
  document.querySelectorAll('[data-role="nextPollCountdown"]').forEach((el) => {
    el.textContent = formatCountdownLabel(el.getAttribute('data-next-poll-at') || '', '-');
  });
}
function startCountdownTicker() {
  if (state.countdownTimer) return;
  state.countdownTimer = setInterval(updateCountdowns, 1000);
}

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

function getRepoUi(repoName) {
  if (!state.repoUi[repoName]) {
    state.repoUi[repoName] = {
      expanded: false,
      filterText: '',
      statusFilter: 'all',
      expandedPrs: {},
      rows: [],
      totalCount: 0,
      hasMore: false,
      nextOffset: 0,
      loading: false,
    };
  }
  return state.repoUi[repoName];
}

function getRepoPrs(repo) {
  if (!repo) return [];
  const ui = getRepoUi(repo.repo);
  return ui.rows || [];
}

function summarizeRepo(repo) {
  const prs = getRepoPrs(repo);
  const paused = prs.filter((pr) => pr.isPaused).length;
  return { paused, totalPrs: repo.summary.totalPrs || prs.length };
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

function renderStatusBadges(pr) {
  return [
    '<span class="status-badge '+(pr.mergeable===false?'badge-conflict':pr.mergeable===true?'badge-clean':'badge-pending')+'">'+esc(pr.mergeable===false?'CONFLICT':pr.mergeable===true?'CLEAN':'UNKNOWN')+'</span>',
    '<span class="status-badge '+(pr.ciStatus==='passing'?'badge-passing':pr.ciStatus==='failed'?'badge-failed':pr.ciStatus==='neutral'?'badge-neutral':'badge-pending')+'">CI '+esc((pr.ciStatus||'unknown').toUpperCase())+'</span>',
    '<span class="status-badge '+(pr.reviewState==='approved'?'badge-approved':pr.reviewState==='changes_requested'?'badge-changes':'badge-pending')+'">'+esc((pr.reviewState||'pending').toUpperCase())+'</span>',
    (pr.isPaused ? '<span class="status-badge badge-paused">PAUSED</span>' : ''),
    (pr.autoMergeEnabled ? '<span class="status-badge badge-clean">AUTO-MERGE</span>' : ''),
  ].filter(Boolean).join(' ');
}

function findDetailItem(repoName, itemNumber, kind) {
  if (kind === 'issue') {
    const repo = getRepositories().find((item) => item.repo === repoName);
    return (repo?.allIssues || []).find((issue) => String(issue.number) === String(itemNumber)) || null;
  }
  const ui = getRepoUi(repoName);
  return (ui.rows || []).find((pr) => String(pr.prNumber) === String(itemNumber)) || null;
}

function closeDetailModal() {
  state.detailModal = null;
  renderDetailModal();
}

function getDetailModalContent(modal = state.detailModal) {
  if (!modal) return '';
  const item = findDetailItem(modal.repoName, modal.itemNumber, modal.kind);
  const job = ([item?.activeJob].filter(Boolean).concat(item?.jobs || [])).find((entry) => entry.key === modal.jobKey) || null;
  return modal.mode === 'output'
    ? (job?.outputTail || job?.running || modal.content || '(no output recorded)')
    : (modal.content || '');
}

async function copyText(text) {
  const value = String(text || '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function copyDetailModalContent(button) {
  if (!state.detailModal) return;
  const originalLabel = button?.textContent || 'Copy';
  await copyText(getDetailModalContent());
  if (!button) return;
  button.textContent = 'Copied';
  setTimeout(() => {
    if (button.isConnected) button.textContent = originalLabel;
  }, 1500);
}

function renderDetailModal() {
  const overlay = $('#detailModal');
  const title = $('#detailModalTitle');
  const subtitle = $('#detailModalSubtitle');
  const body = $('#detailModalBody');
  if (!overlay || !title || !subtitle || !body) return;

  const modal = state.detailModal;
  if (!modal) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
    title.textContent = 'Job detail';
    subtitle.textContent = '-';
    return;
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  const item = findDetailItem(modal.repoName, modal.itemNumber, modal.kind);
  const job = ([item?.activeJob].filter(Boolean).concat(item?.jobs || [])).find((entry) => entry.key === modal.jobKey) || null;
  const label = modal.kind === 'issue'
    ? 'Issue #' + modal.itemNumber
    : 'PR #' + modal.itemNumber;
  const actionLabel = modal.mode === 'log' ? 'Log' : 'Output';
  const sourceLabel = job?.key || modal.jobKey || 'unknown job';

  title.textContent = actionLabel + ' for ' + label;
  subtitle.textContent = sourceLabel + ' · ' + modal.repoName;

  const content = getDetailModalContent(modal) || (modal.mode === 'log' ? 'Loading…' : '(no output recorded)');

  body.innerHTML =
    '<div class="detail-modal-meta">'
    + '<span class="detail-modal-chip">'+esc(modal.repoName)+'</span>'
    + '<span class="detail-modal-chip">'+esc(actionLabel)+'</span>'
    + (job?.agentType ? '<span class="detail-modal-chip">'+esc(job.agentType)+'</span>' : '')
    + (job?.running ? '<span class="detail-modal-chip">'+esc(job.running)+'</span>' : '')
    + (item?.lifecycleState ? '<span class="detail-modal-chip">'+esc(item.lifecycleState)+'</span>' : '')
    + '</div>'
    + '<pre class="detail-modal-pre">'+esc(content)+'</pre>';
}

async function loadInlineJobDetail(kind, repoName, itemNumber, jobKey, mode) {
  state.detailModal = {
    kind,
    repoName,
    itemNumber,
    jobKey,
    mode,
    content: mode === 'output' ? '' : 'Loading…',
  };
  renderDetailModal();

  if (mode === 'log') {
    const item = findDetailItem(repoName, itemNumber, kind);
    const job = ([item?.activeJob].filter(Boolean).concat(item?.jobs || [])).find((entry) => entry.key === jobKey);
    if (!job) {
      state.detailModal.content = 'Job not found';
      renderDetailModal();
      return;
    }

    try {
      const filename = (job.logFile || '').split('/').pop();
      const response = await fetch('/api/logs/' + encodeURIComponent(filename));
      state.detailModal.content = await response.text();
      renderDetailModal();
    } catch (error) {
      state.detailModal.content = 'Error loading log: ' + error.message;
      renderDetailModal();
    }
  } else {
    renderDetailModal();
  }
}

function renderInlineJobItem(context, job) {
  const detailKind = context.kind || 'pr';
  const detailNumber = detailKind === 'issue' ? context.number : context.prNumber;
  const logBtn = '<button class="secondary" data-action="showInlineJobDetail" data-kind="'+esc(detailKind)+'" data-mode="log" data-jobkey="'+esc(job.key)+'" data-repo="'+esc(context.repo)+'" data-number="'+esc(detailNumber)+'">Log</button>';
  const outBtn = '<button class="secondary" data-action="showInlineJobDetail" data-kind="'+esc(detailKind)+'" data-mode="output" data-jobkey="'+esc(job.key)+'" data-repo="'+esc(context.repo)+'" data-number="'+esc(detailNumber)+'">Output</button>';
  const exitLabel = job.code == null ? 'running' : job.code;
  const duration = job.duration || job.running || context.activeJobElapsed || '?';
  return '<div class="history-item"><div><div><strong>'+esc(job.key)+'</strong></div><div class="meta">'+esc(job.agentType||'agent')+' · exit '+esc(exitLabel)+' · '+esc(duration)+' · '+esc(formatDashboardTimestamp(job.startTime, { fallback: 'unknown' }))+'</div></div><div class="action-row">'+logBtn+outBtn+'</div></div>';
}

function renderPrDetailPanel(pr, repoName) {
  const blockers = (pr.blockers || []).length
    ? (pr.blockers || []).map((b) => '<div class="detail-card"><div class="k">Blocker</div><div class="v">'+esc(b.message)+'</div></div>').join('')
    : '<div class="detail-card"><div class="k">Blockers</div><div class="v">No blockers</div></div>';
  const jobs = ((pr.activeJob ? [pr.activeJob] : []).concat(pr.jobs || [])).length
    ? '<div class="inline-jobs">'
      + ((pr.activeJob ? [pr.activeJob] : []).concat(pr.jobs || []).map((job) => renderInlineJobItem({ kind: 'pr', repo: pr.repo, prNumber: pr.prNumber, activeJobElapsed: pr.activeJobElapsed }, job)).join(''))
      + '</div>'
    : '<div class="empty">No jobs yet</div>';

  return '<div class="pr-detail-panel">'
    + '<div class="detail-grid">'
    + '<div class="detail-card"><div class="k">Waiting For</div><div class="v">'+esc(pr.waitingFor || 'Unknown')+'</div></div>'
    + '<div class="detail-card"><div class="k">Last Updated</div><div class="v">'+esc(formatDashboardTimestamp(pr.lastUpdated, { fallback: 'unknown' }))+'</div></div>'
    + '<div class="detail-card"><div class="k">Active Agent</div><div class="v">'+esc(pr.lifecycleState || (pr.hasActiveJob ? 'Active' : 'Idle'))+'</div></div>'
    + '<div class="detail-card"><div class="k">Next Poll</div><div class="v">'+renderCountdownSpan(pr.nextPollAt, esc((pr.nextPollInSeconds || 0) + 's'))+'</div></div>'
    + blockers
    + '</div>'
    + '<div class="action-row">'
    + (pr.isPaused
      ? '<button class="warn" data-action="resumePr" data-repo="'+esc(pr.repo)+'" data-pr="'+esc(pr.prNumber)+'">Resume</button>'
      : '<button class="warn" data-action="pausePr" data-repo="'+esc(pr.repo)+'" data-pr="'+esc(pr.prNumber)+'">Pause</button>')
    + '<button class="secondary" data-action="toggleAutoMerge" data-enabled="'+esc(pr.autoMergeEnabled ? 'false' : 'true')+'" data-repo="'+esc(pr.repo)+'" data-pr="'+esc(pr.prNumber)+'">'+esc(pr.autoMergeEnabled ? 'Disable auto-merge' : 'Enable auto-merge')+'</button>'
    + '<a class="secondary" style="display:inline-flex;align-items:center" href="https://github.com/'+esc(pr.repo)+'/pull/'+esc(pr.prNumber)+'" target="_blank">Open on GitHub</a>'
    + '</div>'
    + '<div><div class="hint" style="margin-bottom:8px">Recent jobs / actions</div>'+jobs+'</div>'
    + '</div>';
}

function renderIssueDetailPanel(issue, repoName) {
  const jobs = ((issue.activeJob ? [issue.activeJob] : []).concat(issue.jobs || [])).length
    ? '<div class="inline-jobs">'
      + ((issue.activeJob ? [issue.activeJob] : []).concat(issue.jobs || []).map((job) => renderInlineJobItem({ kind: 'issue', repo: issue.repo, number: issue.number, activeJobElapsed: issue.activeJobElapsed }, job)).join(''))
      + '</div>'
    : '<div class="empty">No jobs yet</div>';

  return '<div class="issue-detail-panel">'
    + '<div class="detail-grid">'
    + '<div class="detail-card"><div class="k">Waiting For</div><div class="v">'+esc(issue.waitingFor || 'Waiting')+'</div></div>'
    + '<div class="detail-card"><div class="k">Opened</div><div class="v">'+esc(formatDashboardTimestamp(issue.openedAt, { fallback: 'unknown' }))+'</div></div>'
    + '<div class="detail-card"><div class="k">State</div><div class="v">'+esc(issue.lifecycleState || 'Waiting')+'</div></div>'
    + '<div class="detail-card"><div class="k">Next Poll</div><div class="v">'+renderCountdownSpan(issue.nextPollAt, esc((issue.nextPollInSeconds || 0) + 's'))+'</div></div>'
    + '</div>'
    + '<div class="action-row">'
    + '<a class="secondary" style="display:inline-flex;align-items:center" href="https://github.com/'+esc(issue.repo)+'/issues/'+esc(issue.number)+'" target="_blank">Open on GitHub</a>'
    + '</div>'
    + '<div class="detail-card"><div class="k">Recent jobs / actions</div>'+jobs+'</div>'
    + '</div>';
}

function renderIssuePanel(issue, repoName) {
  return '<details class="issue-item" data-issue-number="'+esc(issue.number)+'">'
    + '<summary>'
    + '<div><div class="issue-title">#'+esc(issue.number)+' '+esc(issue.title)+'</div><div class="issue-sub">'+esc((issue.labels || []).join(', ') || 'unlabeled')+'</div></div>'
    + '<div class="issue-title">'+esc(issue.lifecycleState || 'Waiting')+'</div>'
    + '<div class="issue-sub">'+esc(issue.waitingFor || 'Waiting')+'</div>'
    + '<div class="issue-sub">'+esc(issue.activeJobElapsed || 'none')+'</div>'
    + '<div class="issue-sub">'+renderCountdownSpan(issue.nextPollAt, esc((issue.nextPollInSeconds || 0) + 's'))+'</div>'
    + '</summary>'
    + renderIssueDetailPanel(issue, repoName)
    + '</details>';
}

function renderPrRow(pr, repoName) {
  const ui = getRepoUi(repoName);
  const expanded = Boolean(ui.expandedPrs[pr.prNumber]);
  const titleCell = '<div><button class="secondary" data-action="togglePrExpanded" data-repo="'+esc(repoName)+'" data-pr="'+esc(pr.prNumber)+'">'+esc(expanded ? 'Hide' : 'Show')+'</button></div><a class="pr-title" href="https://github.com/'+esc(pr.repo)+'/pull/'+esc(pr.prNumber)+'" target="_blank">#'+esc(pr.prNumber)+' '+esc(pr.title)+'</a><div class="pr-sub">base '+esc(pr.branch||'unknown')+' · jobs '+esc(pr.jobCount || 0)+'</div>';
  const elapsedCell = pr.hasActiveJob ? ('Running · ' + esc(pr.activeJobElapsed || '?')) : esc(pr.lastJobDuration || 'none');
  return '<tr class="pr-row">'
    + '<td>'+titleCell+'</td>'
    + '<td>'+renderStatusBadges(pr)+'</td>'
    + '<td>'+esc(pr.waitingFor || 'Unknown')+'</td>'
    + '<td>'+esc(elapsedCell)+'</td>'
    + '<td>'+renderCountdownSpan(pr.nextPollAt, esc((pr.nextPollInSeconds || 0) + 's'))+'</td>'
    + '<td>'+esc(pr.lifecycleState || (pr.isPaused ? 'Paused' : (pr.hasActiveJob ? 'Active' : 'Waiting')) )+'</td>'
    + '<td>'+(pr.autoMergeEnabled ? 'Enabled' : 'Off')+'</td>'
    + '</tr>'
    + (expanded ? '<tr class="pr-detail-row"><td colspan="7">'+renderPrDetailPanel(pr, repoName)+'</td></tr>' : '');
}

function renderRepoGroup(repo) {
  const ui = getRepoUi(repo.repo);
  const summary = summarizeRepo(repo);
  const visiblePrs = getRepoPrs(repo);
  const visibleIssues = (state.showAll ? (repo.allIssues || []) : (repo.issues || [])).slice();
  const sentinel = ui.hasMore ? '<div class="repo-scroll-sentinel" data-role="repoScrollSentinel" data-repo="'+esc(repo.repo)+'"></div>' : '';

  return '<section class="repo-group repo-group" data-repo-group="'+esc(repo.repo)+'">'
    + '<div class="repo-row">'
    + '<div class="repo-cell"><div class="repo-name">'+esc(repo.repo)+'</div><div class="hint">'+esc(repo.summary.actionablePrs)+' actionable PRs · '+esc(repo.summary.actionableIssues)+' actionable issues</div></div>'
    + '<div class="repo-cell"><div class="label">PRs</div><div class="value">'+esc(summary.totalPrs)+'</div></div>'
    + '<div class="repo-cell"><div class="label">Active Jobs</div><div class="value">'+esc(repo.summary.activeJobs || 0)+'</div></div>'
    + '<div class="repo-cell"><div class="label">Paused</div><div class="value">'+esc(summary.paused)+'</div></div>'
    + '<div class="repo-cell"><div class="label">Hidden</div><div class="value">'+esc((repo.summary.hiddenPrs || 0) + (repo.summary.hiddenIssues || 0))+'</div></div>'
    + '<div class="action-row"><button data-action="toggleRepoExpanded" data-repo="'+esc(repo.repo)+'">'+esc(ui.expanded ? 'Collapse' : 'Expand')+'</button><button class="secondary" data-action="refreshRepo" data-repo="'+esc(repo.repo)+'">Force refresh</button></div>'
    + '</div>'
    + (ui.expanded
      ? '<div>'
        + '<div class="repo-toolbar">'
        + '<input class="repoFilter" data-role="repoFilter" data-repo="'+esc(repo.repo)+'" placeholder="Filter PRs" value="'+esc(ui.filterText)+'">'
        + '<select data-role="repoStatusFilter" data-repo="'+esc(repo.repo)+'">'
        + '<option value="all"'+(ui.statusFilter === 'all' ? ' selected' : '')+'>All</option>'
        + '<option value="ci-failed"'+(ui.statusFilter === 'ci-failed' ? ' selected' : '')+'>CI failed</option>'
        + '<option value="review-pending"'+(ui.statusFilter === 'review-pending' ? ' selected' : '')+'>Review pending</option>'
        + '<option value="paused"'+(ui.statusFilter === 'paused' ? ' selected' : '')+'>Paused</option>'
        + '<option value="active-job"'+(ui.statusFilter === 'active-job' ? ' selected' : '')+'>Active job</option>'
        + '<option value="auto-merge"'+(ui.statusFilter === 'auto-merge' ? ' selected' : '')+'>Auto-merge</option>'
        + '</select>'
        + '<span class="hint">Showing '+esc(visiblePrs.length)+' of '+esc(ui.totalCount || 0)+' PRs'+(ui.loading ? ' · loading…' : '')+'</span>'
        + '</div>'
        + '<div class="repo-scroll" data-repo-scroll="'+esc(repo.repo)+'">'
        + '<table class="pr-table">'
        + '<thead><tr><th>PR</th><th>Status</th><th>Waiting For</th><th>Agent</th><th>Next Poll</th><th>Paused</th><th>Auto-merge</th></tr></thead>'
        + '<tbody>'
        + (visiblePrs.length ? visiblePrs.map((pr) => renderPrRow(pr, repo.repo)).join('') : '<tr><td colspan="7" class="empty">No matching PRs</td></tr>')
        + '</tbody>'
        + '</table>'
        + sentinel
        + '</div>'
        + '<div class="issue-section">'
        + '<div class="issue-section-header"><div><h3 style="font-size:14px;color:#58a6ff">Issues</h3><div class="hint">Expandable issue cards live inside the repo section.</div></div><div class="hint">'+esc(visibleIssues.length)+' issue'+(visibleIssues.length === 1 ? '' : 's')+'</div></div>'
        + '<div class="issue-list">'
        + (visibleIssues.length ? visibleIssues.map((issue) => renderIssuePanel(issue, repo.repo)).join('') : '<div class="empty">No matching issues</div>')
        + '</div>'
        + '</div>'
        + '</div>'
      : '')
    + '</section>';
}

function renderBoard() {
  renderSummary();
  const board = $('#liveBoard');
  if (!board) return;
  const repos = getRepositories();
  if (!repos.length) {
    board.innerHTML = '<div class="panel"><div class="empty">No monitored repositories</div></div>';
    renderDetailModal();
    return;
  }
  board.innerHTML = repos.map((repo) => renderRepoGroup(repo)).join('');
  attachRepoInfiniteScrollObservers();
  $('#generatedAt').textContent = formatDashboardTimestamp(state.snapshot?.generatedAt, { fallback: '-' });
  updateCountdowns();
  renderDetailModal();
}

function findPr(repoName, prNumber) {
  const ui = getRepoUi(repoName);
  return (ui.rows || []).find((pr) => String(pr.prNumber) === String(prNumber)) || null;
}

function attachRepoInfiniteScrollObservers() {
  if (!('IntersectionObserver' in window)) return;
  if (!repoInfiniteObserver) {
    repoInfiniteObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const repoName = entry.target.getAttribute('data-repo');
        loadRepoPage(repoName, { append: true }).catch((error) => console.error(error));
      });
    }, { threshold: 1 });
  }
  document.querySelectorAll('[data-role="repoScrollSentinel"]').forEach((el) => repoInfiniteObserver.observe(el));
}

async function loadRepoPage(repoName, { reset = false, append = false } = {}) {
  const ui = getRepoUi(repoName);
  if (ui.loading) return;
  if (append && !ui.hasMore) return;

  const offset = reset ? 0 : (append ? ui.nextOffset || ui.rows.length : 0);
  const limit = 25;
  ui.loading = true;
  renderBoard();
  try {
    const [owner, repoSlug] = repoName.split('/');
    const page = await fetchJson(
      '/api/dashboard/repo/' + owner + '/' + repoSlug + '/prs?'
        + new URLSearchParams({
          offset: String(offset),
          limit: String(limit),
          showAll: String(state.showAll),
          filterText: ui.filterText || '',
          statusFilter: ui.statusFilter || 'all',
        }).toString()
    );
    const payload = page.page;
    ui.rows = append ? ui.rows.concat(payload.rows || []) : (payload.rows || []);
    ui.totalCount = payload.totalCount || 0;
    ui.hasMore = Boolean(payload.hasMore);
    ui.nextOffset = payload.nextOffset || ui.rows.length;
  } finally {
    ui.loading = false;
    renderBoard();
  }
}

async function loadSnapshot() {
  const resp = await fetchJson('/api/dashboard');
  state.snapshot = resp.snapshot;
  renderBoard();
  const expandedRepos = Object.values(state.repoUi)
    .length
    ? Object.entries(state.repoUi).filter(([, ui]) => ui.expanded).map(([repoName]) => repoName)
    : [];
  for (const repoName of expandedRepos) {
    await loadRepoPage(repoName, { reset: true });
  }
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
    '<tr><td class="hint">'+esc(name)+'</td><td class="hint">'+esc(repo.localPath)+'</td><td><input type="checkbox" data-role="repo-enabled" data-repo="'+esc(name)+'"'+checked(repo.enabled)+'</td><td><button class="secondary" data-action="removeRepoBtn" data-repo="'+esc(name)+'">Remove</button></td></tr>'
  ).join('');
  const promptRows = Object.entries(cfg.promptTemplates || {}).map(([key, value]) =>
    '<div class="detail-card" style="grid-column:1/-1"><div class="k">'+esc(key)+'</div><textarea class="json-editor" style="min-height:120px" data-role="prompt" data-key="'+esc(key)+'">'+esc(value)+'</textarea></div>'
  ).join('');
  const repoOverrideRows = Object.keys(cfg.repos || {}).map((name) => {
    const current = cfg.agentConfig?.perRepoOverride?.[name] || '';
    return '<tr><td class="hint">'+esc(name)+'</td><td><select data-role="repo-agent" data-repo="'+esc(name)+'"><option value=""'+selected(current, '')+'>Default</option><option value="claude"'+selected(current, 'claude')+'>Claude</option><option value="codex"'+selected(current, 'codex')+'>Codex</option></select></td></tr>';
  }).join('');

  root.innerHTML =
    '<div class="detail-card"><table style="width:100%"><tr><th>Name</th><th>Local Path</th><th>Enabled</th><th></th></tr>'+repos+'</table>'
    + '<div class="action-row" style="margin-top:12px"><input id="newRepoName" placeholder="owner/repo"><input id="newRepoPath" placeholder="/path/to/checkout" style="min-width:320px"><button data-action="addRepoBtn">Add repository</button><button data-action="saveRepos">Save repository states</button></div></div>'
    + '<div class="detail-card" style="margin-top:14px"><div class="detail-grid">'
    + '<div class="detail-card"><div class="k">Default Agent</div><div class="v"><select id="defaultAgentSelect"><option value="claude"'+selected(cfg.agentConfig?.defaultAgent,'claude')+'>Claude</option><option value="codex"'+selected(cfg.agentConfig?.defaultAgent,'codex')+'>Codex</option></select></div></div>'
    + '<div class="detail-card"><div class="k">Codex Model</div><div class="v"><input id="codexModelInput" value="'+esc(cfg.agent?.codex?.model || '')+'"></div></div>'
    + '<div class="detail-card"><div class="k">Codex Sandbox</div><div class="v"><select id="codexSandboxSelect"><option value="read-only"'+selected(cfg.agent?.codex?.sandbox,'read-only')+'>read-only</option><option value="workspace-write"'+selected(cfg.agent?.codex?.sandbox,'workspace-write')+'>workspace-write</option><option value="danger-full-access"'+selected(cfg.agent?.codex?.sandbox,'danger-full-access')+'>danger-full-access</option></select></div></div>'
    + '<div class="detail-card"><div class="k">Codex Extra Args</div><div class="v"><input id="codexExtraArgsInput" value="'+esc(cfg.agent?.codex?.extraArgs || '')+'"></div></div>'
    + '<div class="detail-card"><div class="k">Claude Model</div><div class="v"><input id="claudeModelInput" value="'+esc(cfg.agent?.claude?.model || '')+'"></div></div>'
    + '</div><div class="hint" style="margin:12px 0 8px">Per-repository overrides</div><table style="width:100%"><tr><th>Repository</th><th>Agent</th></tr>'+repoOverrideRows+'</table><div class="action-row" style="margin-top:12px"><button data-action="saveDefaultAgent">Save default agent</button><button data-action="saveAgentSettings">Save agent settings</button><button data-action="saveRepoAgents">Save repo overrides</button></div></div>'
    + '<div class="detail-card" style="margin-top:14px"><div class="detail-grid">'+promptRows+'</div><div class="action-row" style="margin-top:12px"><button data-action="savePrompts">Save prompts</button></div></div>'
    + '<div class="detail-card" style="margin-top:14px"><div class="detail-grid">'
    + '<div class="detail-card"><div class="k">Max concurrent jobs</div><div class="v"><input id="maxJobsInput" type="number" min="1" value="'+esc(cfg.settings?.maxConcurrentJobs ?? 1)+'"></div></div>'
    + '<div class="detail-card"><div class="k">Job timeout minutes</div><div class="v"><input id="timeoutInput" type="number" min="1" value="'+esc(cfg.settings?.jobTimeoutMinutes ?? 15)+'"></div></div>'
    + '<div class="detail-card"><div class="k">Bot username</div><div class="v"><input id="botUsernameInput" value="'+esc(cfg.settings?.botUsername || '')+'"></div></div>'
    + '<div class="detail-card"><div class="k">In-progress label</div><div class="v"><input id="inProgressLabelInput" value="'+esc(cfg.settings?.inProgressLabel || '')+'"></div></div>'
    + '<div class="detail-card"><div class="k">Resolved label</div><div class="v"><input id="resolvedLabelInput" value="'+esc(cfg.settings?.agentResolvedLabel || '')+'"></div></div>'
    + '<div class="detail-card"><div class="k">Trigger keywords</div><div class="v"><input id="triggerKeywordsInput" value="'+esc((cfg.settings?.triggerKeywords || []).join(', '))+'"></div></div>'
    + '<div class="detail-card"><div class="k">Issue labels</div><div class="v"><input id="issueLabelsInput" value="'+esc((cfg.settings?.issueLabels || []).join(', '))+'"></div></div>'
    + '<div class="detail-card"><div class="k">Ignored bots</div><div class="v"><input id="ignoredBotsInput" value="'+esc((cfg.settings?.ignoredBots || []).join(', '))+'"></div></div>'
    + '</div><div class="action-row" style="margin-top:12px"><button data-action="saveSettingsPanel">Save settings</button></div></div>';
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

document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'showAllToggle') {
    state.showAll = e.target.checked;
    renderBoard();
    for (const [repoName, ui] of Object.entries(state.repoUi)) {
      if (ui.expanded) {
        await loadRepoPage(repoName, { reset: true });
      }
    }
    return;
  }
  if (e.target.matches('[data-role="repoFilter"]')) {
    const repoName = e.target.getAttribute('data-repo');
    const ui = getRepoUi(repoName);
    ui.filterText = e.target.value || '';
    if (ui.expanded) await loadRepoPage(repoName, { reset: true });
    else renderBoard();
    return;
  }
  if (e.target.matches('[data-role="repoStatusFilter"]')) {
    const repoName = e.target.getAttribute('data-repo');
    const ui = getRepoUi(repoName);
    ui.statusFilter = e.target.value || 'all';
    if (ui.expanded) await loadRepoPage(repoName, { reset: true });
    else renderBoard();
  }
});

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'detailModal') {
    closeDetailModal();
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action === 'toggleRepoExpanded') {
    const repoName = btn.getAttribute('data-repo');
    const ui = getRepoUi(repoName);
    ui.expanded = !ui.expanded;
    renderBoard();
    if (ui.expanded && ui.rows.length === 0) {
      await loadRepoPage(repoName, { reset: true });
    }
  } else if (action === 'refreshRepo') {
    const repo = btn.getAttribute('data-repo');
    const [owner, repoName] = repo.split('/');
    await fetchJson('/api/status/refresh/'+owner+'/'+repoName, { method: 'POST' });
    await loadSnapshot();
  } else if (action === 'togglePrExpanded') {
    const repoName = btn.getAttribute('data-repo');
    const prNumber = btn.getAttribute('data-pr');
    const ui = getRepoUi(repoName);
    ui.expandedPrs[prNumber] = !ui.expandedPrs[prNumber];
    renderBoard();
  } else if (action === 'showInlineJobDetail') {
    await loadInlineJobDetail(
      btn.getAttribute('data-kind') || 'pr',
      btn.getAttribute('data-repo'),
      btn.getAttribute('data-number') || btn.getAttribute('data-pr'),
      btn.getAttribute('data-jobkey'),
      btn.getAttribute('data-mode')
    );
  } else if (action === 'copyDetailModalContent') {
    await copyDetailModalContent(btn);
  } else if (action === 'closeDetailModal') {
    closeDetailModal();
  } else if (action === 'pausePr') {
    const repo = btn.getAttribute('data-repo');
    const [owner, repoName] = repo.split('/');
    const pr = btn.getAttribute('data-pr');
    await fetchJson('/api/pr/'+owner+'/'+repoName+'/'+pr+'/pause', { method: 'POST' });
    await loadSnapshot();
  } else if (action === 'resumePr') {
    const repo = btn.getAttribute('data-repo');
    const [owner, repoName] = repo.split('/');
    const pr = btn.getAttribute('data-pr');
    await fetchJson('/api/pr/'+owner+'/'+repoName+'/'+pr+'/resume', { method: 'POST' });
    await loadSnapshot();
  } else if (action === 'toggleAutoMerge') {
    const repo = btn.getAttribute('data-repo');
    const [owner, repoName] = repo.split('/');
    const pr = btn.getAttribute('data-pr');
    const enabled = btn.getAttribute('data-enabled') === 'true';
    await fetchJson('/api/pr/'+owner+'/'+repoName+'/'+pr+'/auto-merge', { method: 'POST', body: JSON.stringify({ enabled }) });
    await loadSnapshot();
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.detailModal) {
    closeDetailModal();
  }
});

startCountdownTicker();
Promise.all([loadSnapshot(), loadConfigPanel()]).then(connectWebSocket).catch((err) => {
  setConnection('error');
  console.error(err);
});
</script></body></html>`;
}

export { formatDashboardTimestamp, getDashboardHTML };
