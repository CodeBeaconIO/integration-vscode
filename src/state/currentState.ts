import { TreeNodeDataAR } from './activeRecord/treeNodeDataAR';
import { TracedFile } from '../components/editor/tracedFile';

export class CurrentState {
  private static _currentNode: TreeNodeDataAR | null = null;

  constructor() {}

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
}