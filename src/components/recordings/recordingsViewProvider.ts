import * as vscode from 'vscode';
import { Config, createConfig } from '../../config';
import { DbNode, DbErrorNode } from './dbNode';
import { newDbEventEmitter } from '../../eventEmitter';
import path from 'path';
import { MetaDataAR } from '../../state/activeRecord/metaDataAR';
import { SQLiteExecutorFactory } from '../../services/sqlite/SQLiteExecutorFactory';

export class RecordingsTreeProvider implements vscode.TreeDataProvider<DbNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<DbNode | undefined | null | void> = new vscode.EventEmitter<DbNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DbNode | undefined | null | void> = this._onDidChangeTreeData.event;

  private config: Config;
  private static autoIncrementCounter = 0;

  constructor() {
    this.config = createConfig();
    newDbEventEmitter.event(() => {
      this.refresh();
    });
  }

  /**
   * Reset the auto-increment counter (mainly for testing purposes)
   */
  public static resetAutoIncrementCounter(): void {
    RecordingsTreeProvider.autoIncrementCounter = 0;
  }

  getTreeItem(dbNode: DbNode): Thenable<vscode.TreeItem> {
    const dbPath = dbNode.dbPath;
    const executor = SQLiteExecutorFactory.createExecutor(dbPath);
    MetaDataAR.reconnectDb(executor);
    const metaData = new MetaDataAR(dbPath);
    return metaData.findById(1).then((row) => {
      executor.close();
      
      // Check if name is empty or not provided, generate fallback name
      let displayName: string;
      let displayDescription: string | undefined;
      
      if (row.name && row.name.trim() !== '') {
        // Use provided name
        displayName = row.name;
        displayDescription = row.description;
      } else if (row.caller_method && row.caller_method.trim() !== '') {
        // Use caller_method as fallback name
        displayName = row.caller_method;
        if (row.description && row.description.trim() !== '') {
          displayDescription = row.description;
        } else {
          // Generate description from caller_file and caller_line (use filename only)
          const filename = path.basename(row.caller_file);
          displayDescription = `${filename}:${row.caller_line}`;
        }
      } else if (row.caller_file && row.caller_file.trim() !== '') {
        // Use caller_file as fallback name (extract filename)
        displayName = path.basename(row.caller_file);
        displayDescription = row.description;
      } else {
        // Last resort: auto-increment counter
        displayName = `Trace-${++RecordingsTreeProvider.autoIncrementCounter}`;
        displayDescription = row.description;
      }
      
      dbNode.setName(displayName);
      
      // Set description if it exists
      if (displayDescription) {
        dbNode.setDescription(displayDescription);
      }
      
      // Set the full metadata for rich tooltip
      dbNode.setMetadata(row);
      
      dbNode.setFileName(row.dbBasename);
      return dbNode;
    }).catch(() => {
      executor.close();
      const baseName = path.basename(dbPath);
      return new DbErrorNode(baseName, dbPath);
    });
  }

  async getChildren(dbNode?: DbNode): Promise<DbNode[]> {
    // Check if the database directory exists before trying to read it
    try {
      const dbDirStat = await vscode.workspace.fs.stat(vscode.Uri.file(this.config.getDbDir()));
      if (!(dbDirStat.type & vscode.FileType.Directory)) {
        return Promise.resolve([]);
      }
    } catch (error) {
      // Directory doesn't exist or can't be accessed
      return Promise.resolve([]);
    }
    if (dbNode) {
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
          return dbFilesWithStats.map(file => {
            return new DbNode(file.filePath);
          });
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
