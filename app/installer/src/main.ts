import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildEnvContent, configFromEnv, defaultConfig, parseEnv, validateConfig, extractClaudeToken,
  composeArgs, composeEnv, dashboardUrl, generateAppSecret, type InstallerConfig, type ComposeAction,
} from './core.js';

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;

/**
 * Electron main process — the GUI installer + control panel (ADR-0002 D4, local-Docker
 * first). The wizard collects config, captures the Claude credential, writes `.env`, and
 * drives `docker compose`; after install it doubles as a control panel (start/stop/clean/
 * logs/open dashboard). All pure logic lives in core.ts; this file is IPC + child_process.
 */

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 720,
    title: 'EliteFlow Nebula Installer',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void mainWindow.loadFile(join(app.getAppPath(), 'public', 'index.html'));
}

/** Best guess for the EliteFlow `app/` directory (holds infra/docker-compose.yml + .env).
 *  In dev the installer runs from app/installer, so the parent is app/. */
function defaultAppDir(): string {
  return resolve(app.getAppPath(), '..');
}

const composeFileFor = (appDir: string): string => join(appDir, 'infra', 'docker-compose.yml');
const envPathFor = (appDir: string): string => join(appDir, '.env');

/** Spawn a command, streaming stdout/stderr lines to the renderer over `channel`.
 *  `env` overlays process.env — used to set DOCKER_HOST for a remote target. */
function runStreaming(
  channel: string, cmd: string, args: string[], cwd: string, env: Record<string, string> = {},
): Promise<{ ok: boolean; code: number | null }> {
  return new Promise((resolvePromise) => {
    const send = (line: string): void => mainWindow?.webContents.send(channel, line);
    const hostNote = env.DOCKER_HOST ? ` (DOCKER_HOST=${env.DOCKER_HOST})` : '';
    send(`$ ${cmd} ${args.join(' ')}${hostNote}`);
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32', env: { ...process.env, ...env } });
    child.stdout.on('data', (d) => send(d.toString()));
    child.stderr.on('data', (d) => send(d.toString()));
    child.on('error', (err) => { send(`ERROR: ${err.message}`); resolvePromise({ ok: false, code: null }); });
    child.on('close', (code) => { send(`\n[exit ${code}]`); resolvePromise({ ok: code === 0, code }); });
  });
}

async function dockerStatus(dockerHost?: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const env = dockerHost ? { ...process.env, DOCKER_HOST: dockerHost } : process.env;
    const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], { env });
    return { ok: true, version: stdout.trim() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Detect an existing install at `appDir`: parse its .env for update-mode prefill. */
function detectEnv(appDir: string): { exists: boolean; hasCompose: boolean; config: InstallerConfig } {
  const envPath = envPathFor(appDir);
  const exists = existsSync(envPath);
  const config = exists
    ? configFromEnv(parseEnv(readFileSync(envPath, 'utf8')))
    : { ...defaultConfig(), workspacePath: join(appDir, '..', 'workspace'), sourceRepoPath: join(appDir, '..', 'product') };
  return { exists, hasCompose: existsSync(composeFileFor(appDir)), config };
}

/** Spawn `claude setup-token` (browser OAuth), streaming output; parse the printed token. */
function claudeLogin(): Promise<{ ok: boolean; token?: string; error?: string }> {
  return new Promise((resolvePromise) => {
    const send = (line: string): void => mainWindow?.webContents.send('installer:claudeLog', line);
    let out = '';
    const child = spawn('claude', ['setup-token'], { shell: process.platform === 'win32' });
    child.stdout.on('data', (d) => { const s = d.toString(); out += s; send(s); });
    child.stderr.on('data', (d) => { const s = d.toString(); out += s; send(s); });
    child.on('error', (err) => resolvePromise({ ok: false, error: err.message }));
    child.on('close', () => {
      const token = extractClaudeToken(out);
      resolvePromise(token ? { ok: true, token } : { ok: false, error: 'Could not parse a token from the output — paste it manually.' });
    });
  });
}

app.whenReady().then(() => {
  ipcMain.handle('installer:appInfo', () => ({
    name: app.getName(), version: app.getVersion(),
    platform: process.platform, electron: process.versions.electron,
  }));
  ipcMain.handle('installer:dockerStatus', (_e, dockerHost?: string) => dockerStatus(dockerHost));
  ipcMain.handle('installer:defaultAppDir', () => defaultAppDir());
  ipcMain.handle('installer:detectEnv', (_e, appDir: string) => detectEnv(appDir));

  ipcMain.handle('installer:pickFolder', async (_e, title: string) => {
    const res = await dialog.showOpenDialog(mainWindow!, { title, properties: ['openDirectory', 'createDirectory'] });
    return res.canceled ? null : res.filePaths[0]!;
  });

  ipcMain.handle('installer:claudeLogin', () => claudeLogin());

  ipcMain.handle('installer:install', async (_e, config: InstallerConfig, appDir: string) => {
    const errs = validateConfig(config);
    if (errs.length) return { ok: false, errors: errs };
    if (!existsSync(composeFileFor(appDir))) {
      return { ok: false, errors: [`No docker-compose.yml under ${appDir}\\infra — is this the EliteFlow app folder?`] };
    }
    const cfg = { ...config, appSecret: config.appSecret || generateAppSecret() };
    writeFileSync(envPathFor(appDir), buildEnvContent(cfg), 'utf8');
    const r = await runStreaming('installer:composeLog', 'docker', composeArgs('up', composeFileFor(appDir)), appDir, composeEnv(cfg));
    return { ok: r.ok, code: r.code, errors: [] as string[] };
  });

  ipcMain.handle('installer:compose', (_e, action: ComposeAction, appDir: string, dockerHost?: string) =>
    runStreaming('installer:composeLog', 'docker', composeArgs(action, composeFileFor(appDir)), appDir,
      dockerHost ? { DOCKER_HOST: dockerHost } : {}));

  ipcMain.handle('installer:logs', async (_e, appDir: string, tail: number, dockerHost?: string) => {
    try {
      const env = dockerHost ? { ...process.env, DOCKER_HOST: dockerHost } : process.env;
      const { stdout, stderr } = await execFileAsync(
        'docker', ['compose', '-f', composeFileFor(appDir), 'logs', '--tail', String(tail)],
        { cwd: appDir, env, maxBuffer: 10 * 1024 * 1024 });
      return { ok: true, text: stdout || stderr };
    } catch (err) {
      return { ok: false, text: (err as Error).message };
    }
  });

  ipcMain.handle('installer:openDashboard', (_e, config: InstallerConfig) =>
    shell.openExternal(dashboardUrl(config)));

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
