import * as vscode from 'vscode';
import { Config, createConfig } from '../../config';
import { DbNode, DbErrorNode } from './dbNode';
import { newDbEventEmitter } from '../../eventEmitter';
import path from 'path';
import { MetaDataAR } from '../../state/activeRecord/metaDataAR';

export class RecordingsTreeProvider implements vscode.TreeDataProvider<string> {
  private _onDidChangeTreeData: vscode.EventEmitter<string | undefined | null | void> = new vscode.EventEmitter<string | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<string | undefined | null | void> = this._onDidChangeTreeData.event;

  private config: Config;

  constructor() {
    this.config = createConfig();
    newDbEventEmitter.event(() => {
      this.refresh();
    });
  }

  getTreeItem(dbPath: string): Thenable<vscode.TreeItem> {
    const metaData = new MetaDataAR(dbPath);
    return metaData.findById(1).then((row) => {
      return new DbNode(row.name, row.description, row.dbBasename);
    }).catch(() => {
      const baseName = path.basename(dbPath);
      return new DbErrorNode(baseName, dbPath);
    });
  }

  getChildren(dbPath?: string): Thenable<string[]> {
    if (dbPath) {
      return Promise.resolve([]);
    } else {
      return vscode.workspace.fs.readDirectory(vscode.Uri.file(this.config.getDbDir())).then((dbFiles) => {
        const dbFilePromises = dbFiles
          .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.db'))
          .map(([name]) => {
            const filePath = path.join(this.config.getDbDir(), name);
            return vscode.workspace.fs.stat(vscode.Uri.file(filePath)).then((stat) => ({
              filePath,
              ctime: stat.ctime
            }));
          });
        return Promise.all(dbFilePromises).then((dbFilesWithStats) => {
          dbFilesWithStats.sort((a, b) => b.ctime - a.ctime);
          return dbFilesWithStats.map(file => file.filePath);
        });
      });
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // loadNodeId(nodeId: string): void {
  //   this.treeNodeId = nodeId;
  //   this._onDidChangeTreeData.fire();
  // }
}
