import * as vscode from 'vscode';
import { newDbEventEmitter, newDbInstanceEventEmitter, reloadEventEmitter, recordingDeletedEventEmitter } from '../../eventEmitter';
import { SQLiteConnection } from './sqliteConnection';
import { TreeNodeDataAR } from '../activeRecord/treeNodeDataAR';
import { NodeSourceAR } from '../activeRecord/nodeSourceAR';
import { DeleteRecordingHandler } from '../../components/recordings/deleteRecordingHandler';

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
      false  // [Don't] ignore delete events - now we want to handle them
    );
  }

  public get watcher(): vscode.FileSystemWatcher {
    return this._refreshWatcher;
  }

  registerCommandHandlers() {
    vscode.commands.registerCommand('recordingsTree.loadDb', (dbFileName) => {
      SQLiteConnection.connect(dbFileName); 
      newDbInstanceEventEmitter.fire({uri: vscode.Uri.file(dbFileName)});
    });

    vscode.commands.registerCommand('codeBeacon.deleteRecording', (dbNode) => {
      DeleteRecordingHandler.deleteRecording(dbNode);
    });
  }

  public startWatching(): void {
    this.registerDbEvents();
    this.onUpdate((uri: vscode.Uri) => {
			newDbEventEmitter.fire({uri: uri});
		});
    this.onDelete((uri: vscode.Uri) => {
      recordingDeletedEventEmitter.fire({uri: uri});
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

  private onDelete(callback: (uri: vscode.Uri) => void): void {
    this._refreshWatcher.onDidDelete((uri) => {
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
