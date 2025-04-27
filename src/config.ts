import * as vscode from 'vscode';
import * as path from 'path';

export interface IConfig {
  getDataDir(): string;
  getDbDir(): string;
  getDbPath(): string;
  getRefreshPath(): string;
  getRootDir(): string;
  getPathsPath(): string;
  getSqliteBinaryPath(): string;
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
    return this.workspaceConfig.get('code-beacon.rootDir', process.cwd());
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
}

export function createConfig(): Config {
  return new Config(vscode.workspace.getConfiguration());
}