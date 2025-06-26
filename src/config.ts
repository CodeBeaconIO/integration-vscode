import * as vscode from 'vscode';
import * as path from 'path';
import { TRACER_CONFIG_FILENAME } from './components/remoteTracing/types';

export interface IConfig {
  getDataDir(): string;
  getDbDir(): string;
  getDbPath(): string;
  getRefreshPath(): string;
  getRootDir(): string;
  getPathsPath(): string;
  getSqliteBinaryPath(): string;
  getTracingEnabled(): boolean;
  getRemoteTracingConfigPath(): string;
  getRemoteTracingEnabled(): boolean;
  setRemoteTracingEnabled(enabled: boolean): Promise<void>;
}

export class Config implements IConfig {
  private readonly dbName = 'codebeacon_tracer.db';
  private readonly defaultDataDir = '.code-beacon';
  private readonly refreshPath = 'tmp/refresh';
  private readonly workspaceConfig: vscode.WorkspaceConfiguration;

  constructor(workspaceConfig: vscode.WorkspaceConfiguration) {
    this.workspaceConfig = workspaceConfig;
  }

  getRootDir(): string {
    const configuredRoot = this.workspaceConfig.get<string>('code-beacon.rootDir', '');
    if (configuredRoot && configuredRoot.trim() !== '') {
      return configuredRoot;
    }

    vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'rootNotSet');

    // Return an empty string so that any downstream path resolution attempts
    // will fail fast, ensuring the extension halts until the user completes
    // the setup workflow.
    return '';
  }

  getDataDir(): string {
    const dataDir = this.workspaceConfig.get('code-beacon.dataDir', this.defaultDataDir);
    return path.resolve(this.getRootDir(), dataDir);
  }

  getDbDir(): string {
    return path.resolve(this.getDataDir(), 'db');
  }

  getDbPath(): string {
    return path.resolve(this.getDataDir(), 'db', this.dbName);
  }

  getRefreshPath(): string {
    return path.resolve(this.getDataDir(), this.refreshPath);
  }

  getPathsPath(): string {
    return path.join(this.getDataDir(), 'paths.yml');
  }

  getSqliteBinaryPath(): string {
    return this.workspaceConfig.get('code-beacon.sqliteBinaryPath', '');
  }

  getTracingEnabled(): boolean {
    return this.workspaceConfig.get('code-beacon.tracingEnabled', true);
  }

  getRemoteTracingConfigPath(): string {
    return path.resolve(this.getDataDir(), TRACER_CONFIG_FILENAME);
  }

  getRemoteTracingEnabled(): boolean {
    return this.workspaceConfig.get('code-beacon.remoteTracing.enabled', false);
  }

  async setRemoteTracingEnabled(enabled: boolean): Promise<void> {
    await this.workspaceConfig.update('code-beacon.remoteTracing.enabled', enabled, vscode.ConfigurationTarget.Workspace);
  }
}

export function createConfig(): Config {
  return new Config(vscode.workspace.getConfiguration());
}