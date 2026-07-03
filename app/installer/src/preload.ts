import { contextBridge, ipcRenderer } from 'electron';
import type { InstallerConfig, ComposeAction } from './core.js';

/**
 * Preload bridge — the only surface the renderer can touch (contextIsolation on,
 * nodeIntegration off). Methods map to ipcMain.handle channels; the two `on*` helpers
 * subscribe to the streaming log channels the main process pushes during long ops.
 */

export interface DetectResult { exists: boolean; hasCompose: boolean; config: InstallerConfig }
export interface InstallResult { ok: boolean; code?: number | null; errors: string[] }
export interface ComposeResult { ok: boolean; code: number | null }

export interface InstallerApi {
  appInfo(): Promise<{ name: string; version: string; platform: string; electron: string }>;
  dockerStatus(dockerHost?: string): Promise<{ ok: boolean; version?: string; error?: string }>;
  defaultAppDir(): Promise<string>;
  detectEnv(appDir: string): Promise<DetectResult>;
  pickFolder(title: string): Promise<string | null>;
  claudeLogin(): Promise<{ ok: boolean; token?: string; error?: string }>;
  install(config: InstallerConfig, appDir: string): Promise<InstallResult>;
  compose(action: ComposeAction, appDir: string, dockerHost?: string): Promise<ComposeResult>;
  logs(appDir: string, tail: number, dockerHost?: string): Promise<{ ok: boolean; text: string }>;
  openDashboard(config: InstallerConfig): Promise<void>;
  onComposeLog(cb: (line: string) => void): void;
  onClaudeLog(cb: (line: string) => void): void;
}

const api: InstallerApi = {
  appInfo: () => ipcRenderer.invoke('installer:appInfo'),
  dockerStatus: (dockerHost) => ipcRenderer.invoke('installer:dockerStatus', dockerHost),
  defaultAppDir: () => ipcRenderer.invoke('installer:defaultAppDir'),
  detectEnv: (appDir) => ipcRenderer.invoke('installer:detectEnv', appDir),
  pickFolder: (title) => ipcRenderer.invoke('installer:pickFolder', title),
  claudeLogin: () => ipcRenderer.invoke('installer:claudeLogin'),
  install: (config, appDir) => ipcRenderer.invoke('installer:install', config, appDir),
  compose: (action, appDir, dockerHost) => ipcRenderer.invoke('installer:compose', action, appDir, dockerHost),
  logs: (appDir, tail, dockerHost) => ipcRenderer.invoke('installer:logs', appDir, tail, dockerHost),
  openDashboard: (config) => ipcRenderer.invoke('installer:openDashboard', config),
  onComposeLog: (cb) => { ipcRenderer.on('installer:composeLog', (_e, line: string) => cb(line)); },
  onClaudeLog: (cb) => { ipcRenderer.on('installer:claudeLog', (_e, line: string) => cb(line)); },
};

contextBridge.exposeInMainWorld('installer', api);
