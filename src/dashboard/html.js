function getDashboardHTML() {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Webhook Monitor</title>
<meta name="theme-color" content="#0969da">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GH Webhook">
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="apple-touch-icon" href="/favicon-192.png">
<link rel="manifest" href="/manifest.json">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9}
.topbar{background:linear-gradient(135deg,#023e6b,#0077b6,#00b4d8);padding:12px 24px;display:flex;align-items:center;gap:16px}
.topbar h1{font-size:18px;color:#fff;font-weight:600}
.topbar .status{margin-left:auto;display:flex;gap:12px;align-items:center}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.green{background:#3fb950} .dot.red{background:#f85149} .dot.amber{background:#d29922}
.badge{background:rgba(255,255,255,.15);color:#fff;padding:2px 10px;border-radius:12px;font-size:13px}
.container{max-width:1200px;margin:0 auto;padding:20px}
.tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:8px 18px;border-radius:8px 8px 0 0;cursor:pointer;background:#161b22;color:#8b949e;border:1px solid #30363d;border-bottom:none;font-size:14px;user-select:none}
.tab.active{background:#0d1117;color:#c9d1d9}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:16px}
.panel h2{font-size:15px;color:#58a6ff;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:#8b949e;font-weight:500;padding:8px;border-bottom:1px solid #30363d}
td{padding:8px;border-bottom:1px solid #21262d;vertical-align:top}
.mono{font-family:'SF Mono',Consolas,monospace;font-size:12px}
input,select,textarea{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:6px 10px;font-size:13px;font-family:inherit}
input:focus,select:focus,textarea:focus{border-color:#58a6ff;outline:none}
textarea{width:100%;min-height:100px;resize:vertical;font-family:'SF Mono',Consolas,monospace;font-size:12px;line-height:1.5}
button{background:#238636;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px}
button:hover{background:#2ea043}
button.danger{background:#da3633} button.danger:hover{background:#f85149}
button.secondary{background:#30363d;color:#c9d1d9}
.toggle{position:relative;width:40px;height:22px;display:inline-block}
.toggle input{opacity:0;width:0;height:0}
.toggle .slider{position:absolute;inset:0;background:#30363d;border-radius:11px;cursor:pointer;transition:.2s}
.toggle .slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#8b949e;border-radius:50%;transition:.2s}
.toggle input:checked+.slider{background:#238636}
.toggle input:checked+.slider::before{transform:translateX(18px);background:#fff}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.flex-1{flex:1;min-width:150px}
.tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;margin:2px;cursor:default}
.tag .x{cursor:pointer;margin-left:4px;opacity:.6} .tag .x:hover{opacity:1}
.tag.kw{background:#1f2937;color:#93c5fd;border:1px solid #374151}
.tag.label{background:#1c1917;color:#fbbf24;border:1px solid #44403c}
.tag.bot{background:#1a1a2e;color:#a78bfa;border:1px solid #312e81}
.section-tab{display:none} .section-tab.active{display:block}
.job-card{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:8px}
.job-card .key{color:#58a6ff;font-weight:600;font-size:13px}
.job-card .meta{color:#8b949e;font-size:12px;margin-top:4px}
.job-card .agent-badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;margin-left:8px}
.agent-badge.claude{background:#1a1a2e;color:#a78bfa;border:1px solid #312e81}
.agent-badge.codex{background:#1a2e1a;color:#86efac;border:1px solid #166534}
pre.log{background:#0d1117;padding:12px;border-radius:6px;font-size:11px;max-height:400px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-family:'SF Mono',Consolas,monospace;line-height:1.4}
.live-output{border-left:3px solid #58a6ff;padding-left:12px;margin-top:8px}
.empty{color:#484f58;font-style:italic;padding:20px;text-align:center}
.ev-row{padding:4px 0;font-size:12px;border-bottom:1px solid #161b22}
.ev-row .ts{color:#484f58;width:180px;display:inline-block} .ev-row .ev{color:#58a6ff}
.radio-group{display:flex;gap:4px}
.radio-group label{padding:6px 14px;border:1px solid #30363d;border-radius:6px;cursor:pointer;font-size:13px;background:#0d1117}
.radio-group input{display:none}
.radio-group input:checked+span{color:#58a6ff;font-weight:600}
.radio-group label:has(input:checked){border-color:#58a6ff;background:#161b22}
.hint{color:#484f58;font-size:11px;margin-top:2px}
.pr-card{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:12px}
.pr-card .pr-header{display:flex;gap:8px;align-items:baseline;margin-bottom:8px;flex-wrap:wrap}
.pr-card .pr-number{color:#58a6ff;font-weight:600;font-size:14px}
.pr-card .pr-title{color:#c9d1d9;flex:1;font-size:13px}
.pr-card .status-badges{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.status-badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.badge-clean{background:#238636;color:#fff}
.badge-passing{background:#238636;color:#fff}
.badge-pending{background:#d29922;color:#000}
.badge-failed{background:#f85149;color:#fff}
.badge-approved{background:#238636;color:#fff}
.badge-changes{background:#f85149;color:#fff}
.badge-conflict{background:#f85149;color:#fff}
.badge-draft{background:#d29922;color:#000}
.pr-card .blockers{margin-top:8px;padding-top:8px;border-top:1px solid #30363d}
.blocker-item{font-size:12px;color:#8b949e;margin:4px 0;padding-left:12px;position:relative}
.blocker-item::before{content:'⚠';position:absolute;left:0;color:#d29922;font-size:10px}
.blocker-item.error{color:#f85149}
.blocker-item.error::before{content:'✕';color:#f85149}
.blocker-item.success{color:#238636}
.blocker-item.success::before{content:'✓';color:#238636}
</style></head><body>
<div class="topbar">
  <img src="/logo.svg" alt="GitHub Webhook Monitor" style="height:32px;width:auto;filter:brightness(0) invert(1)">
  <h1>Webhook Monitor</h1>
  <div class="status">
    <span class="dot green" id="sDot"></span>
    <span class="badge" id="sAgent">...</span>
    <span class="badge" id="sUptime">...</span>
    <span class="badge" id="sJobs">0 jobs</span>
  </div>
</div>
<div class="container">
  <div class="tabs" id="tabBar"></div>
  <div id="tabContent"></div>
</div>
<script>
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const api = async (u, o) => (await fetch(u, {headers:{'Content-Type':'application/json'},...o})).json();

const TABS = ['Dashboard','Status','Repos','Agent','Prompts','Settings','Jobs','Work Report','Events','Dispatch'];
let currentTab = 'Dashboard';

function renderTabs() {
  $('#tabBar').innerHTML = TABS.map(t => '<div class="tab'+(t===currentTab?' active':'')+'" onclick="switchTab(\\''+t+'\\')">'+t+'</div>').join('');
}
function switchTab(t) { currentTab = t; renderTabs(); renderContent(); }

async function renderContent() {
  const cfg = await api('/api/config');
  const el = $('#tabContent');
  switch(currentTab) {
    case 'Dashboard': el.innerHTML = dashboardTab(); refreshDashboard(); break;
    case 'Status': el.innerHTML = statusTab(); refreshStatus(); break;
    case 'Repos': el.innerHTML = reposTab(cfg); break;
    case 'Agent': el.innerHTML = agentTab(cfg); break;
    case 'Prompts': el.innerHTML = promptsTab(cfg); break;
    case 'Settings': el.innerHTML = settingsTab(cfg); break;
    case 'Jobs': el.innerHTML = jobsTab(); refreshJobs(); break;
    case 'Work Report': el.innerHTML = workReportTab(); refreshWorkReport(); break;
    case 'Events': el.innerHTML = eventsTab(); refreshEvents(); break;
    case 'Dispatch': el.innerHTML = dispatchTab(); refreshDispatch(); break;
  }
}

// --- Dashboard ---
function parseJobKey(key) {
  const rxPattern = '^([a-zA-Z0-9]+)-(.+?)(-[0-9]+|-[a-f0-9]+)?$';
  const match = key.match(new RegExp(rxPattern));
  if (!match) return { type: 'job', display: key };
  const [, type, repoAndNum, num] = match;
  const typeMap = { issue: '📋 Issue', pr: '🔀 PR', review: '👁️ Review', ci: '🔧 CI', conflict: '⚔️ Conflict' };
  const displayType = typeMap[type] || type;
  const numStr = (num || '').replace('-', '');
  let displayLink = displayType + ' ' + repoAndNum + (num || '');
  if (numStr && (type === 'issue' || type === 'pr' || type === 'review')) {
    const ghUrl = 'https://github.com/' + repoAndNum + '/' + (type === 'issue' ? 'issues' : 'pull') + '/' + numStr;
    displayLink = displayType + ' <a href="' + ghUrl + '" target="_blank" style="color:#58a6ff;text-decoration:underline">' + repoAndNum + '#' + numStr + '</a>';
  }
  return { type: displayType, repo: repoAndNum, num: numStr, display: displayLink };
}
function dashboardTab() { return '<div class="panel"><h2>Active Jobs</h2><div id="dActive"><div class="empty">No active jobs</div></div></div><div class="panel"><h2>Recent Events</h2><div id="dEvents"><div class="empty">No events</div></div></div>'; }
async function refreshDashboard() {
  const [jobs, events] = await Promise.all([api('/api/jobs'), api('/api/events')]);
  const a = $('#dActive'); const e = $('#dEvents');
  if (!a) return;
  if (jobs.active.length) {
    a.innerHTML = jobs.active.map(j => {
      const parsed = parseJobKey(j.key);
      return '<div class="job-card"><div class="key" style="font-size:14px;font-weight:600">'+parsed.display+'<span class="agent-badge '+j.agentType+'">'+j.agentType+'</span></div><div class="meta">PID '+j.pid+' | '+j.running+'</div><div class="live-output"><pre class="log">'+esc(j.output||'(waiting...)')+'</pre></div><button class="danger" style="margin-top:6px" data-action="killJob" data-args="\\''+esc(j.key)+'\\'">Kill</button></div>';
    }).join('');
  } else { a.innerHTML = '<div class="empty">No active jobs</div>'; }
  if (e && events.length) {
    e.innerHTML = events.slice(0,15).map(ev => '<div class="ev-row"><span class="ts mono">'+esc(ev.ts)+'</span> <span class="ev">'+esc(ev.event+':'+ev.action)+'</span> '+esc(ev.repo)+' — '+esc(ev.summary)+'</div>').join('');
  }
}

// --- Status ---
function statusTab() {
  return '<div class="panel"><h2>PR Status Overview</h2><p class="hint">Real-time status of all open pull requests. Auto-refreshes every 10 seconds.</p><div id="sPRs"><div class="empty">Loading...</div></div></div>';
}
async function refreshStatus() {
  try {
    const resp = await api('/api/status');
    const statuses = resp.statuses || [];
    const el = $('#sPRs');
    if (!el) return;

    if (!statuses.length) {
      el.innerHTML = '<div class="empty">No open PRs cached</div>';
      return;
    }

    el.innerHTML = statuses.map(s => {
      const blockerHtml = (s.blockers || []).length > 0
        ? '<div class="blockers"><strong>Blockers:</strong>' + s.blockers.map(b =>
            '<div class="blocker-item '+(b.severity||'warning')+'">'+esc(b.message)+'</div>'
          ).join('') + '</div>'
        : '';

      const ciClass = s.ciStatus === 'passing' ? 'badge-passing' : s.ciStatus === 'failed' ? 'badge-failed' : 'badge-pending';
      const reviewClass = s.reviewState === 'approved' ? 'badge-approved' : s.reviewState === 'changes_requested' ? 'badge-changes' : 'badge-pending';
      const mergeClass = s.mergeable === false ? 'badge-conflict' : s.mergeable === true ? 'badge-clean' : 'badge-pending';
      const draftBadge = s.isDraft ? '<span class="status-badge badge-draft">DRAFT</span>' : '';

      return '<div class="pr-card">'
        + '<div class="pr-header">'
        + '<span class="pr-number">#'+s.prNumber+'</span>'
        + '<span class="pr-title">'+esc(s.title)+'</span>'
        + '</div>'
        + '<div class="status-badges">'
        + draftBadge
        + '<span class="status-badge '+mergeClass+'">'+esc(s.mergeable===false?'CONFLICT':s.mergeable===true?'CLEAN':'UNKNOWN')+'</span>'
        + '<span class="status-badge '+ciClass+'">CI: '+esc(s.ciStatus || 'unknown').toUpperCase()+'</span>'
        + '<span class="status-badge '+reviewClass+'">'+esc(s.reviewState || 'pending').toUpperCase()+'</span>'
        + (s.unresolvedThreads > 0 ? '<span class="status-badge badge-pending">'+s.unresolvedThreads+' unresolved</span>' : '')
        + '</div>'
        + blockerHtml
        + '<div class="hint" style="margin-top:6px;font-size:10px">Updated: '+esc(s.lastUpdated || 'unknown')+'</div>'
        + '</div>';
    }).join('');
  } catch (err) {
    const el = $('#sPRs');
    if (el) el.innerHTML = '<div class="empty">Error loading status: '+esc(err.message)+'</div>';
  }
}

// --- Repos ---
function reposTab(cfg) {
  let rows = Object.entries(cfg.repos).map(([n,r]) => '<tr><td class="mono">'+esc(n)+'</td><td class="mono">'+esc(r.localPath)+'</td><td><label class="toggle"><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="toggleRepo(\\''+esc(n)+'\\',this.checked)"><span class="slider"></span></label></td><td><button class="danger" data-action="removeRepo" data-args="\\''+esc(n)+'\\'">Remove</button></td></tr>').join('');
  return '<div class="panel"><h2>Monitored Repositories</h2><table><tr><th>Repository</th><th>Local Path</th><th>Enabled</th><th></th></tr>'+rows+'</table><hr style="border-color:#30363d;margin:16px 0"><h2>Add Repository</h2><div class="row"><input id="nrName" placeholder="owner/repo" class="flex-1"><input id="nrPath" placeholder="/path/to/checkout" class="flex-1"><button onclick="addRepo()">Add</button></div></div>';
}
async function addRepo() { await api('/api/repos',{method:'POST',body:JSON.stringify({name:$('#nrName').value.trim(),localPath:$('#nrPath').value.trim()})}); renderContent(); }
async function removeRepo(n) { if(!confirm('Remove '+n+'?'))return; await fetch('/api/repos/'+n,{method:'DELETE'}); renderContent(); }
async function toggleRepo(n,on) { const c=await api('/api/config'); c.repos[n].enabled=on; await api('/api/config',{method:'POST',body:JSON.stringify({repos:c.repos})}); }

// --- Agent ---
function agentTab(cfg) {
  const a = cfg.agent;
  const ac = cfg.agentConfig || { defaultAgent: 'claude', perRepoOverride: {} };
  let repoRows = Object.entries(cfg.repos).map(([n,r]) => {
    const override = ac.perRepoOverride[n];
    const agent = override || ac.defaultAgent;
    return '<tr><td class="mono">'+esc(n)+'</td><td><select id="ag_'+n+'" style="width:150px"><option value=""'+(override===undefined?' selected':'')+'>Default ('+ac.defaultAgent+')</option><option value="claude"'+(agent==='claude'?' selected':'')+'>Claude</option><option value="codex"'+(agent==='codex'?' selected':'')+'>Codex</option></select></td><td><button data-action="saveRepoAgent" data-args="\\''+esc(n)+'\\'">Save</button></td></tr>';
  }).join('');

  return '<div class="panel"><h2>Default Agent Type</h2><div class="row"><div class="radio-group">'
    + radioBtn('agentType','claude','Claude Code',ac.defaultAgent==='claude')
    + radioBtn('agentType','codex','Codex CLI',ac.defaultAgent==='codex')
    + '</div></div><button onclick="saveDefaultAgent()">Save Default</button></div>'
    + '<div class="panel"><h2>Per-Repository Overrides</h2><table><tr><th>Repository</th><th>Agent</th><th></th></tr>'+repoRows+'</table></div>'
    + '<div class="panel" id="claudeCfg" style="display:'+(a.type==='claude'?'block':'none')+'"><h2>Claude Code Settings</h2>'
    + field('Claude CLI path','cBin',a.claude.bin,'claude')
    + '<div class="row"><label style="width:180px">Model</label><select id="cModel" style="width:200px"><option value="">Default (auto)</option><option value="sonnet"'+(a.claude.model==='sonnet'?' selected':'')+'>Sonnet (fast)</option><option value="opus"'+(a.claude.model==='opus'?' selected':'')+'>Opus (powerful)</option><option value="haiku"'+(a.claude.model==='haiku'?' selected':'')+'>Haiku (light)</option></select></div>'
    + field('Extra args','cExtra',a.claude.extraArgs,'--dangerously-skip-permissions')
    + '<button onclick="saveAgent(\\'claude\\')">Save Claude Settings</button></div>'
    + '<div class="panel" id="codexCfg" style="display:'+(a.type==='codex'?'block':'none')+'"><h2>Codex CLI Settings</h2>'
    + field('Codex CLI path','xBin',a.codex.bin,'codex')
    + field('Model','xModel',a.codex.model,'gpt-5.3-codex')
    + '<div class="row"><label style="width:180px">Reasoning effort</label><select id="xReason" style="width:200px"><option value="xhigh"'+(a.codex.reasoningEffort==='xhigh'?' selected':'')+'>xhigh (reviews/analysis)</option><option value="high"'+(a.codex.reasoningEffort==='high'?' selected':'')+'>high (code edits)</option><option value="medium"'+(a.codex.reasoningEffort==='medium'?' selected':'')+'>medium</option><option value="low"'+(a.codex.reasoningEffort==='low'?' selected':'')+'>low</option></select></div>'
    + '<div class="row"><label style="width:180px">Sandbox</label><select id="xSandbox" style="width:200px"><option value="read-only"'+(a.codex.sandbox==='read-only'?' selected':'')+'>read-only</option><option value="workspace-write"'+(a.codex.sandbox==='workspace-write'?' selected':'')+'>workspace-write</option><option value="danger-full-access"'+(a.codex.sandbox==='danger-full-access'?' selected':'')+'>danger-full-access</option></select></div>'
    + field('Extra args','xExtra',a.codex.extraArgs,'--full-auto')
    + '<button onclick="saveAgent(\\'codex\\')">Save Codex Settings</button></div>';
}
function radioBtn(name,val,label,checked) { return '<label><input type="radio" name="'+name+'" value="'+val+'" '+(checked?'checked':'')+' onchange="switchAgent(\\''+val+'\\')"><span>'+label+'</span></label>'; }
function field(label,id,val,ph) { return '<div class="row"><label style="width:180px">'+label+'</label><input id="'+id+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:300px"></div>'; }
async function switchAgent(type) {
  await api('/api/agent',{method:'POST',body:JSON.stringify({defaultAgent:type})});
  renderContent();
}
async function saveDefaultAgent() {
  const checked = $$('input[name="agentType"]:checked');
  if (checked.length > 0) {
    await api('/api/agent',{method:'POST',body:JSON.stringify({defaultAgent:checked[0].value})});
    renderContent();
  }
}
async function saveRepoAgent(repo) {
  const select = $('#ag_'+repo);
  if (!select) return;
  const agent = select.value || null;
  const [owner, repoName] = repo.split('/');
  await api('/api/repos/'+owner+'/'+repoName+'/agent',{method:'POST',body:JSON.stringify({agent})});
  renderContent();
}
async function saveAgent(type) {
  if (type==='claude') {
    await api('/api/agent',{method:'POST',body:JSON.stringify({type:'claude',claude:{bin:$('#cBin').value,model:$('#cModel').value,extraArgs:$('#cExtra').value}})});
  } else {
    await api('/api/agent',{method:'POST',body:JSON.stringify({type:'codex',codex:{bin:$('#xBin').value,model:$('#xModel').value,reasoningEffort:$('#xReason').value,sandbox:$('#xSandbox').value,extraArgs:$('#xExtra').value}})});
  }
  renderContent();
}

// --- Prompts ---
function promptsTab(cfg) {
  const tpls = cfg.promptTemplates;
  let html = '<div class="panel"><h2>Prompt Templates</h2><p class="hint" style="margin-bottom:16px">Use {{variable}} placeholders. Each event type has its own template and available variables.</p>';
  const vars = {
    pull_request_review: 'prNumber, prTitle, reviewer, reviewState, repo',
    check_suite: 'branch, sha, repo',
    issues: 'issueNumber, issueTitle, action, labels, repo',
    issue_comment: 'prNumber, prTitle, author, body, repo',
  };
  for (const [key, tpl] of Object.entries(tpls)) {
    html += '<h2 style="margin-top:16px">'+esc(key)+'</h2><div class="hint">Variables: '+esc(vars[key]||'')+'</div><textarea id="tpl_'+key+'" rows="5">'+esc(tpl)+'</textarea>';
  }
  html += '<button style="margin-top:12px" onclick="savePrompts()">Save All Templates</button></div>';
  return html;
}
async function savePrompts() {
  const body = {};
  $$('textarea[id^=tpl_]').forEach(ta => { body[ta.id.replace('tpl_','')]=ta.value; });
  await api('/api/prompts',{method:'POST',body:JSON.stringify(body)});
  renderContent();
}

// --- Settings ---
function settingsTab(cfg) {
  const s = cfg.settings;
  let evHtml = Object.entries(s.enabledEvents).map(([ev,on]) => '<div class="row"><label style="width:220px">'+esc(ev)+'</label><label class="toggle"><input type="checkbox" '+(on?'checked':'')+' onchange="toggleEv(\\''+ev+'\\',this.checked)"><span class="slider"></span></label></div>').join('');
  return '<div class="panel"><h2>General</h2>'
    + '<div class="row"><label style="width:220px">Max concurrent jobs</label><input id="sMaxJ" type="number" min="1" max="10" value="'+s.maxConcurrentJobs+'" style="width:80px"><button onclick="saveSetting(\\'maxConcurrentJobs\\',+$(\\'\\'#sMaxJ\\'\\').value)">Save</button></div>'
    + '<div class="row"><label style="width:220px">Job timeout (minutes)</label><input id="sTimeout" type="number" min="1" max="60" value="'+s.jobTimeoutMinutes+'" style="width:80px"><button onclick="saveSetting(\\'jobTimeoutMinutes\\',+$(\\'\\'#sTimeout\\'\\').value)">Save</button></div>'
    + '</div><div class="panel"><h2>Enabled Events</h2>'+evHtml+'</div>'
    + '<div class="panel"><h2>Issue Coordination</h2>'
    + '<div class="row"><label style="width:220px">Use assignment for coordination</label><label class="toggle"><input type="checkbox" '+(s.useAssignmentForCoordination?'checked':'')+' onchange="toggleBool(\\'useAssignmentForCoordination\\',this.checked)"><span class="slider"></span></label></div>'
    + '<div class="row"><label style="width:220px">Use labels for coordination</label><label class="toggle"><input type="checkbox" '+(s.useLabelsForCoordination?'checked':'')+' onchange="toggleBool(\\'useLabelsForCoordination\\',this.checked)"><span class="slider"></span></label></div>'
    + '<div class="row"><label style="width:220px">Bot username</label><input id="sBotUser" value="'+(s.botUsername||'github-actions[bot]')+'" style="width:300px"><button onclick="saveSetting(\\'botUsername\\',$(\\'#sBotUser\\').value)">Save</button></div>'
    + '<div class="row"><label style="width:220px">In-progress label</label><input id="sInProgLabel" value="'+(s.inProgressLabel||'agent-working')+'" style="width:300px"><button onclick="saveSetting(\\'inProgressLabel\\',$(\\'#sInProgLabel\\').value)">Save</button></div>'
    + '<div class="row"><label style="width:220px">Resolved label</label><input id="sResolvedLabel" value="'+(s.agentResolvedLabel||'agent-resolved')+'" style="width:300px"><button onclick="saveSetting(\\'agentResolvedLabel\\',$(\\'#sResolvedLabel\\').value)">Save</button></div>'
    + '</div>'
    + tagPanel('Gate Check Names','gateCheckNames',s.gateCheckNames||[],'kw','newGate')
    + tagPanel('Trigger Keywords','triggerKeywords',s.triggerKeywords,'kw','newKw')
    + tagPanel('Auto-fix Issue Labels','issueLabels',s.issueLabels,'label','newLbl')
    + tagPanel('Ignored Bots','ignoredBots',s.ignoredBots,'bot','newBot')
    + tagPanel('Auto-resolve Bots','autoResolveBots',s.autoResolveBots||[],'bot','newAutoBot');
}
function tagPanel(title,key,arr,cls,inputId) {
  return '<div class="panel"><h2>'+title+'</h2><div>'+arr.map(v=>'<span class="tag '+cls+'">'+esc(v)+'<span class="x" data-action="removeTag" data-args="\\''+key+'\\',\\''+esc(v)+'\\'"> x</span></span>').join(' ')+'</div><div class="row" style="margin-top:8px"><input id="'+inputId+'" placeholder="Add..."><button onclick="addTag(\\''+key+'\\',\\''+inputId+'\\')">Add</button></div></div>';
}
async function saveSetting(k,v) { await api('/api/settings',{method:'POST',body:JSON.stringify({[k]:v})}); }
async function toggleBool(key,on) { await api('/api/settings',{method:'POST',body:JSON.stringify({[key]:on})}); }
async function toggleEv(ev,on) { const c=await api('/api/config'); c.settings.enabledEvents[ev]=on; await api('/api/settings',{method:'POST',body:JSON.stringify({enabledEvents:c.settings.enabledEvents})}); }
async function addTag(key,inputId) { const v=$('#'+inputId).value.trim(); if(!v)return; const c=await api('/api/config'); c.settings[key].push(v); await api('/api/settings',{method:'POST',body:JSON.stringify({[key]:c.settings[key]})}); renderContent(); }
async function removeTag(key,val) { const c=await api('/api/config'); c.settings[key]=c.settings[key].filter(x=>x!==val); await api('/api/settings',{method:'POST',body:JSON.stringify({[key]:c.settings[key]})}); renderContent(); }

// --- Work Report ---
function workReportTab() { return '<div class="panel"><h2>Agent Work Report</h2><p class="hint">What agents have fixed, created, and resolved</p><div id="wReport"><div class="empty">Loading...</div></div></div>'; }
async function refreshWorkReport() {
  const r = $('#wReport');
  if (!r) return;
  try {
    const jobs = await api('/api/jobs');
    const history = jobs.history || [];
    if (history.length === 0) {
      r.innerHTML = '<div class="empty">No agent work yet</div>';
      return;
    }
    const grouped = {};
    history.forEach(h => {
      const [type, ...rest] = h.key.split('-');
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(h);
    });
    let html = '';
    Object.entries(grouped).forEach(([type, jobs]) => {
      const icon = {issue:'📋',pr:'🔀',review:'👁️',ci:'🔧',conflict:'⚔️'}[type] || '⚙️';
      html += '<div class="panel" style="background:#0d1117;border-left:4px solid #58a6ff"><h3 style="margin-bottom:12px">'+icon+' '+type.toUpperCase()+'</h3>';
      html += jobs.slice(0,5).map(j => '<div style="padding:8px;margin:4px 0;background:#161b22;border-radius:4px;font-size:12px"><strong>'+esc(j.key)+'</strong><br/><span style="color:#8b949e">Duration: '+j.duration+' | Exit: '+j.code+'</span><br/><span style="color:#58a6ff">'+esc((j.outputTail||'').split('\\n').slice(-1)[0].substring(0,100))+'</span></div>').join('');
      html += '</div>';
    });
    r.innerHTML = html;
  } catch(e) { r.innerHTML = '<div class="empty">Error loading report</div>'; }
}

// --- Jobs ---
function jobsTab() { return '<div class="panel"><h2>Job Queue Status</h2><div id="jStats"><div class="empty">Loading...</div></div></div><div class="panel"><h2>Pending Jobs (Queue)</h2><div id="jQueue"><div class="empty">No pending jobs</div></div></div><div class="panel"><h2>Active Jobs (live output)</h2><div id="jActive"><div class="empty">No active jobs</div></div></div><div class="panel"><h2>Job History</h2><div id="jHist"></div></div><div class="panel" id="logPanel" style="display:none"><h2>Session Log</h2><pre class="log" id="logOut"></pre></div>'; }
async function refreshJobs() {
  const d = await api('/api/jobs');
  const stats = await api('/api/jobs/stats');

  // Queue stats
  const s = $('#jStats');
  if(s) {
    const capacity = stats.capacity;
    const pct = Math.round((capacity.used / capacity.total) * 100);
    const barFill = Array(Math.round(pct/5)).fill('█').join('')+Array(20-Math.round(pct/5)).fill('░').join('');
    s.innerHTML = '<div style="margin-bottom:12px"><strong>Capacity:</strong> '+capacity.used+'/'+capacity.total+' ('+pct+'%)</div><div style="font-family:monospace;margin-bottom:12px;font-size:12px">'+barFill+'</div><div><strong>Pending:</strong> '+stats.pendingJobs+' jobs in queue</div>';
  }

  // Pending queue
  const q = $('#jQueue');
  if(q) {
    if(d.pending && d.pending.length) {
      q.innerHTML = d.pending.map((j,i) => {
        const parsed = parseJobKey(j.jobKey);
        return '<div class="job-card" style="opacity:0.8"><div class="key" style="color:#d29922;font-size:14px;font-weight:600">⏳ Queue #'+(i+1)+' — '+parsed.display+'</div><div class="meta">Queued: '+esc(new Date(j.queuedAt).toLocaleTimeString())+' | Repo: '+esc(j.repoFullName)+'</div></div>';
      }).join('');
    } else { q.innerHTML='<div class="empty">No pending jobs</div>'; }
  }

  // Active jobs
  const a = $('#jActive');
  if(!a) return;
  if(d.active.length) {
    a.innerHTML = d.active.map(j => {
      const parsed = parseJobKey(j.key);
      return '<div class="job-card"><div class="key" style="font-size:14px;font-weight:600">'+parsed.display+'<span class="agent-badge '+j.agentType+'">'+j.agentType+'</span></div><div class="meta">PID '+j.pid+' | Running '+j.running+'</div><div class="live-output"><pre class="log" style="max-height:200px">'+esc(j.output||'(waiting...)')+'</pre></div><button class="danger" style="margin-top:6px" data-action="killJob" data-args="\\''+esc(j.key)+'\\'">Kill</button></div>';
    }).join('');
  } else { a.innerHTML='<div class="empty">No active jobs</div>'; }

  // History
  const h = $('#jHist');
  if(h && d.history.length) {
    h.innerHTML = '<table><tr><th>Job</th><th>Agent</th><th>Exit</th><th>Duration</th><th>Time</th><th></th></tr>'+d.history.map(j => {
      const fname = (j.logFile||'').split('/').pop();
      return '<tr><td class="mono">'+esc(j.key)+'</td><td><span class="agent-badge '+(j.agentType||'claude')+'">'+(j.agentType||'claude')+'</span></td><td>'+j.code+'</td><td>'+j.duration+'</td><td class="mono" style="font-size:11px">'+esc(j.startTime)+'</td><td><button class="secondary" data-action="viewLog" data-args="\\''+esc(fname)+'\\'">Log</button> <button class="secondary" onclick="viewOutput(\\''+esc(j.key)+'\\')">Output</button></td></tr>';
    }).join('')+'</table>';
  }
}
async function killJob(k) { await api('/api/jobs/'+encodeURIComponent(k)+'/kill',{method:'POST'}); setTimeout(()=>{if(currentTab==='Jobs')refreshJobs();else refreshDashboard();},1000); }
async function viewLog(f) { $('#logPanel').style.display='block'; const r=await fetch('/api/logs/'+f); $('#logOut').textContent=await r.text(); }
function viewOutput(key) {
  const d = jobHistory_cache?.find(j=>j.key===key);
  if(d?.outputTail) { $('#logPanel').style.display='block'; $('#logOut').textContent=d.outputTail; }
}
let jobHistory_cache;
(async()=>{ const d=await api('/api/jobs'); jobHistory_cache=d.history; })();

// --- Events ---
function eventsTab() { return '<div class="panel"><h2>Event Log</h2><div id="eFull"><div class="empty">No events</div></div></div>'; }
async function refreshEvents() {
  const ev = await api('/api/events');
  const el = $('#eFull'); if(!el||!ev.length) return;
  el.innerHTML = ev.map(e => '<div class="ev-row"><span class="ts mono">'+esc(e.ts)+'</span> <span class="ev">'+esc(e.event+':'+e.action)+'</span> '+esc(e.repo)+' — '+esc(e.summary)+'</div>').join('');
}

// --- Dispatch ---
function dispatchTab() {
  return '<div class="panel"><h2>Dispatcher Statistics</h2><div id="dStats"><div class="empty">Loading...</div></div></div><div class="panel"><h2>Recent Decisions</h2><div id="dRecent"><div class="empty">No decisions</div></div></div>';
}
async function refreshDispatch() {
  try {
    const [stats, decisions] = await Promise.all([api('/api/dispatch-stats'), api('/api/dispatch-history?limit=30')]);
    const sEl = $('#dStats'), rEl = $('#dRecent');
    if (!sEl || !rEl) return;
    let statsHtml = '<table><tr><th>Metric</th><th>Value</th></tr>';
    statsHtml += '<tr><td>History Size</td><td>'+stats.historySize+' / '+stats.maxHistorySize+'</td></tr>';
    Object.entries(stats.actionCounts||{}).forEach(([action, count]) => {
      statsHtml += '<tr><td>'+esc(action)+'</td><td>'+count+'</td></tr>';
    });
    statsHtml += '</table>';
    sEl.innerHTML = statsHtml;
    if (decisions.count > 0) {
      rEl.innerHTML = decisions.decisions.map(d => '<div class="ev-row"><span class="ts mono">'+esc(d.timestamp)+'</span> '+esc(d.repo)+' #'+d.prRef+' <span class="ev">'+esc(d.event)+'</span> → '+esc(d.actions.join(', '))+'</div>').join('');
    } else {
      rEl.innerHTML = '<div class="empty">No decisions</div>';
    }
  } catch (e) {
    console.error('Error loading dispatch data:', e);
  }
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// --- Health bar + auto-refresh ---
async function tick() {
  try {
    const h = await api('/api/health');
    $('#sDot').className='dot green';
    $('#sAgent').textContent=h.agentType;
    $('#sUptime').textContent=fmt(h.uptime);
    const pending = h.pendingJobs || 0;
    let jobStatus = h.activeJobs + ' job' + (h.activeJobs !== 1 ? 's' : '');
    if (pending > 0) jobStatus += ' + ' + pending + ' queued';
    $('#sJobs').textContent = jobStatus;
  } catch { $('#sDot').className='dot red'; }
  if(currentTab==='Dashboard') refreshDashboard();
  else if(currentTab==='Status') refreshStatus();
  else if(currentTab==='Jobs') refreshJobs();
  else if(currentTab==='Work Report') refreshWorkReport();
  else if(currentTab==='Dispatch') refreshDispatch();
}
function fmt(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';return Math.floor(s/86400)+'d';}

// Global event delegation for all click-based actions
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const args = btn.getAttribute('data-args');
  if (action === 'killJob' && args) {
    await killJob(args.replace(/['"]+/g, ''));
  } else if (action === 'removeRepo' && args) {
    await removeRepo(args.replace(/['"]+/g, ''));
  } else if (action === 'saveRepoAgent' && args) {
    await saveRepoAgent(args.replace(/['"]+/g, ''));
  } else if (action === 'removeTag') {
    const [key, val] = args.split('|');
    await removeTag(key.replace(/['"]+/g, ''), val.replace(/['"]+/g, ''));
  } else if (action === 'addTag') {
    const inputId = args.replace(/['"]+/g, '');
    await addTag(inputId.split('|')[0], inputId.split('|')[1]);
  } else if (action === 'viewLog') {
    viewLog(args.replace(/['"]+/g, ''));
  } else if (action === 'viewOutput') {
    viewOutput(args.replace(/['"]+/g, ''));
  }
}, true);

renderTabs(); renderContent(); tick(); setInterval(tick, 5000);
</script></body></html>`;
}

export { getDashboardHTML };
