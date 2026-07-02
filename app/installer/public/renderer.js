// Renderer (wizard + control panel). Plain JS — no Node access; everything goes through
// window.installer (the preload bridge). Mirrors the screens designed for ADR-0002 D4.
'use strict';

const $ = (id) => document.getElementById(id);
const state = { appDir: '', mode: 'fresh', dataChoice: 'keep', config: null };

// Form field id-suffix → config key. Fields not listed (postgresUser/Db, maxRunsPerCycle,
// appSecret) are carried through from state.config untouched.
const FIELDS = [
  'projectName', 'deployTarget', 'dockerHost', 'workspacePath', 'sourceRepoPath',
  'postgresPassword', 'claudeModel', 'postgresPort', 'webPort', 'timezone', 'cycleCron',
  'authKind', 'oauthToken', 'apiKey', 'antigravityToken',
];

const STEPS = ['step-mode', 'step-config', 'step-cred', 'step-data', 'step-run', 'panel'];
let currentLog = null;

function show(id) {
  STEPS.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  if (id === 'step-run') currentLog = $('compose-log');
  if (id === 'panel') { currentLog = $('panel-log'); refreshPanel(); }
}
function append(el, text) { if (el) { el.textContent += text; el.scrollTop = el.scrollHeight; } }

function loadConfigToForm(c) {
  FIELDS.forEach((k) => { const el = $('c-' + k); if (el) el.value = c[k] ?? ''; });
  toggleAuthBlocks();
  toggleTarget();
}
function readFormToConfig() {
  FIELDS.forEach((k) => { const el = $('c-' + k); if (el) state.config[k] = el.value; });
}
function toggleAuthBlocks() {
  const oauth = $('c-authKind').value === 'oauth_token';
  $('oauth-block').classList.toggle('hidden', !oauth);
  $('apikey-block').classList.toggle('hidden', oauth);
}
function toggleTarget() {
  const remote = $('c-deployTarget').value === 'remote';
  $('remote-note').classList.toggle('hidden', !remote);
  // Local browse pickers can't reach a remote filesystem — disable them for remote.
  $('pick-workspace').disabled = remote;
  $('pick-source').disabled = remote;
}
/** Docker host to pass with control-panel actions (blank for local). */
function activeDockerHost() {
  return (state.config && state.config.deployTarget === 'remote') ? (state.config.dockerHost || '') : '';
}

async function detect() {
  state.appDir = $('app-dir').value.trim();
  const res = await window.installer.detectEnv(state.appDir);
  state.config = res.config;
  const parts = [];
  parts.push(res.hasCompose ? '✓ app folder looks valid' : '⚠ no infra/docker-compose.yml here');
  parts.push(res.exists ? '· existing .env found (update available)' : '· no existing install');
  $('mode-detect').textContent = parts.join(' ');
  $('mode-update').classList.toggle('hidden', !res.exists);
  $('mode-panel').classList.toggle('hidden', !res.exists);
}

function dashHost(c) {
  if (c.deployTarget !== 'remote' || !c.dockerHost) return 'localhost';
  const m = /^ssh:\/\/(?:[^@/\s]+@)?([^:/\s]+)/.exec(c.dockerHost.trim());
  return m ? m[1] : 'localhost';
}

function runSummary() {
  const c = state.config;
  const target = c.deployTarget === 'remote' ? `remote (${c.dockerHost})` : 'local';
  return [
    `Folder: ${state.appDir}`,
    `Target: ${target}`,
    `Mode: ${state.mode}${state.mode === 'update' ? ' (' + state.dataChoice + ')' : ''}`,
    `Dashboard: http://${dashHost(c)}:${c.webPort} · Postgres :${c.postgresPort}`,
    `Auth: ${c.authKind}`,
  ].join('\n');
}

async function refreshPanel() {
  const d = await window.installer.dockerStatus(activeDockerHost());
  const where = activeDockerHost() ? ' @ ' + activeDockerHost() : '';
  $('docker-line').innerHTML = d.ok
    ? '<span class="badge ok">Docker running · ' + d.version + where + '</span>'
    : '<span class="badge bad">Docker not reachable' + where + '</span>';
}

async function doCompose(action) {
  $('panel-log').textContent = '';
  const r = await window.installer.compose(action, state.appDir, activeDockerHost());
  append($('panel-log'), r.ok ? '\n✓ done' : '\n✗ failed');
}

async function init() {
  window.installer.onComposeLog((line) => append(currentLog, line));
  window.installer.onClaudeLog((line) => append($('claude-log'), line));

  $('app-dir').value = await window.installer.defaultAppDir();
  await detect();
  show('step-mode');

  // Mode step
  $('pick-app-dir').onclick = async () => {
    const p = await window.installer.pickFolder('Select the EliteFlow app folder');
    if (p) { $('app-dir').value = p; await detect(); }
  };
  $('app-dir').onchange = detect;
  $('mode-fresh').onclick = () => { state.mode = 'fresh'; loadConfigToForm(state.config); show('step-config'); };
  $('mode-update').onclick = () => { state.mode = 'update'; loadConfigToForm(state.config); show('step-config'); };
  $('mode-panel').onclick = () => show('panel');

  // Generic Back/Next buttons
  document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => show(b.dataset.back); });
  document.querySelectorAll('[data-next]').forEach((b) => {
    b.onclick = () => { if (b.dataset.next === 'step-run') $('run-summary').textContent = runSummary(); show(b.dataset.next); };
  });

  // Config pickers
  $('pick-workspace').onclick = async () => { const p = await window.installer.pickFolder('Workspace folder'); if (p) $('c-workspacePath').value = p; };
  $('pick-source').onclick = async () => { const p = await window.installer.pickFolder('Product repo folder'); if (p) $('c-sourceRepoPath').value = p; };

  // Deployment target
  $('c-deployTarget').onchange = () => { if (state.config) state.config.deployTarget = $('c-deployTarget').value; toggleTarget(); };

  // Credential
  $('c-authKind').onchange = toggleAuthBlocks;
  $('claude-login').onclick = async () => {
    const btn = $('claude-login'); btn.disabled = true; $('claude-log').textContent = '';
    const r = await window.installer.claudeLogin();
    if (r.ok && r.token) $('c-oauthToken').value = r.token;
    else append($('claude-log'), '\n' + (r.error || 'login failed') + '\n(Paste the token manually above.)');
    btn.disabled = false;
  };
  $('cred-next').onclick = () => {
    readFormToConfig();
    if (state.mode === 'update') show('step-data');
    else { $('run-summary').textContent = runSummary(); show('step-run'); }
  };

  // Data step (update only)
  $('data-keep').onclick = () => { state.dataChoice = 'keep'; $('data-keep').classList.remove('ghost'); $('data-clean').classList.add('ghost'); };
  $('data-clean').onclick = () => { state.dataChoice = 'clean'; $('data-clean').classList.remove('ghost'); $('data-keep').classList.add('ghost'); };

  // Run
  $('run-start').onclick = async () => {
    readFormToConfig();
    $('run-errors').textContent = ''; $('compose-log').textContent = '';
    $('run-status').textContent = 'working…'; $('run-start').disabled = true;
    try {
      if (state.mode === 'update' && state.dataChoice === 'clean') {
        await window.installer.compose('down-clean', state.appDir);
      }
      const r = await window.installer.install(state.config, state.appDir);
      if (!r.ok) {
        $('run-errors').textContent = (r.errors && r.errors.length) ? r.errors.join('\n') : 'Install failed — see log.';
        $('run-status').textContent = 'failed';
      } else {
        $('run-status').innerHTML = '<span class="badge ok">stack started</span>';
        $('run-done').classList.remove('hidden');
      }
    } finally {
      $('run-start').disabled = false;
    }
  };

  // Control panel
  $('p-start').onclick = () => doCompose('start');
  $('p-stop').onclick = () => doCompose('stop');
  $('p-clean').onclick = () => doCompose('down-clean');
  $('p-dashboard').onclick = () => window.installer.openDashboard(state.config);
  $('p-logs').onclick = async () => { const r = await window.installer.logs(state.appDir, 200, activeDockerHost()); $('panel-log').textContent = r.text; };
  $('p-reconfigure').onclick = () => show('step-mode');
}

window.addEventListener('DOMContentLoaded', init);
