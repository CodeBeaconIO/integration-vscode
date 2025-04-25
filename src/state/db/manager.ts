import * as vscode from 'vscode';
import { newDbEventEmitter, newDbInstanceEventEmitter, reloadEventEmitter } from '../../eventEmitter';
import SQLite3Connection from './sqlite3Connection';
import { TreeNodeDataAR } from '../activeRecord/treeNodeDataAR';
import { NodeSourceAR } from '../activeRecord/nodeSourceAR';

export class DBManager {
  private _refreshWatcher: vscode.FileSystemWatcher;
  private _refreshPath: string;

  constructor(refreshPath: string) {
    this._refreshPath = refreshPath;
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(this._refreshPath),
      '*'
    );
    this._refreshWatcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      false, // [Don't] ignore create events
      false, // [Don't] ignore change events
      true   // Do ignore delete events
    );
  }

  public get watcher(): vscode.FileSystemWatcher {
    return this._refreshWatcher;
  }

  registerCommandHandlers() {
    vscode.commands.registerCommand('recordingsTree.loadDb', (dbFileName) => {
      SQLite3Connection.connect(dbFileName);
      newDbInstanceEventEmitter.fire();
    });
  }

  public startWatching(): void {
    this.registerDbEvents();
    this.onUpdate((uri: vscode.Uri) => {
			newDbEventEmitter.fire({uri: uri});
		});
  }

  public stopWatching(): void {
    this._refreshWatcher.dispose();
  }

  private onUpdate(callback: (uri: vscode.Uri) => void): void {
    this._refreshWatcher.onDidChange((uri) => {
      callback(uri);
    });
    this._refreshWatcher.onDidCreate((uri) => {
      callback(uri);
    });
  }

  private registerDbEvents() {
    newDbInstanceEventEmitter.event(() => {
      TreeNodeDataAR.reconnectDb();
      NodeSourceAR.reconnectDb();
      reloadEventEmitter.fire();
    });
  }
}
