import * as vscode from 'vscode';
import { TreeNodeDataAR } from './state/activeRecord/treeNodeDataAR';

export const nodeSelectionEventEmitter = new vscode.EventEmitter<{ prevNode: TreeNodeDataAR | null, node: TreeNodeDataAR }>();
export const editorSelectionEventEmitter = new vscode.EventEmitter<{ uri: vscode.Uri, line: number }>();
export const fileSelectionEventEmitter = new vscode.EventEmitter<{ uri: vscode.Uri, prevNode: TreeNodeDataAR | null }>();
export const documentVisibilityChangedEventEmitter = new vscode.EventEmitter<{ editors: readonly vscode.TextEditor[] }>();
export const fileVisibilityEventEmitter = new vscode.EventEmitter<{ editors: vscode.TextEditor[] }>();
export const treeConfigUpdatedEventEmitter = new vscode.EventEmitter<void>();
export const newDbEventEmitter = new vscode.EventEmitter<{ uri: vscode.Uri}>();
export const newDbInstanceEventEmitter = new vscode.EventEmitter<void>();
export const reloadEventEmitter = new vscode.EventEmitter<void>();
