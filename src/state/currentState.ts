import { TreeNodeDataAR } from './activeRecord/treeNodeDataAR';
import { TracedFile } from '../components/editor/tracedFile';
import * as vscode from 'vscode';
import { newDbInstanceEventEmitter, recordingDeletedEventEmitter } from '../eventEmitter';

export class CurrentState {
  private static _currentNode: TreeNodeDataAR | null = null;
  private static _currentDbUri: vscode.Uri | null = null;

  static {
    newDbInstanceEventEmitter.event(({ uri }) => {
      CurrentState._currentDbUri = uri;
    });

    recordingDeletedEventEmitter.event(({ uri }) => {
      // Clear current state if the deleted recording was the active one
      if (CurrentState._currentDbUri && CurrentState._currentDbUri.fsPath === uri.fsPath) {
        CurrentState.clearCurrentState();
      }
    });
  }

  static matches(filePath: string): boolean;
  static matches(filePath: string, lineNumber: number): boolean;
  static matches(tracedFile: TracedFile): boolean;
  static matches(tracedFile: TracedFile, lineNumber: number): boolean;
  static matches(file: string | TracedFile, lineNumber?: number): boolean {
    if (file instanceof TracedFile) {
      file = file.uri.fsPath;
    }
    const treeSelection = this.currentNode();
    const allTreeNodeLines = treeSelection?.getLineRanges().map((range) => range.line) || [];
    if (
        treeSelection
        && treeSelection.getFile() === file
        && (lineNumber === null || lineNumber === undefined || allTreeNodeLines.includes(lineNumber))
      ) {
        return true;
      } else {
        return false;
      }
  }

  static currentNode(): TreeNodeDataAR | null {
    return this._currentNode;
  }

  static setCurrentNode(node: TreeNodeDataAR | null): void {
    this._currentNode = node;
  }

  static currentDbUri(): vscode.Uri | null {
    return this._currentDbUri;
  }

  static clearCurrentState(): void {
    this._currentNode = null;
    this._currentDbUri = null;
  }
}
