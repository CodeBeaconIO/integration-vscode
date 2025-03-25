import * as vscode from 'vscode';
import * as path from 'path';

export class Config {
  static readonly DB_NAME='codebeacon_tracer.db';
  static readonly REFRESH_PATH='tmp/refresh';

  static get dataDir(): string {
    const dataDir = vscode.workspace.getConfiguration().get('code-beacon.dataDir', '');
    return path.resolve(Config.rootDir, dataDir);
  }

  static get dbDir(): string {
    return path.resolve(Config.dataDir, 'db');
  }

  static get dbPath(): string {
    return path.resolve(Config.dataDir, 'db', Config.DB_NAME);
  }

  static get refreshPath(): string {
    return path.resolve(Config.dataDir, Config.REFRESH_PATH);
  }

  public static get rootDir(): string {
    return vscode.workspace.getConfiguration().get('code-beacon.rootDir', '');
  }

  public static get pathsPath(): string {
    return path.join(Config.dataDir, 'paths.yml');
  }
}