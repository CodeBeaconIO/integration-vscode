import * as vscode from 'vscode';
import { RecordingsTreeProvider } from '../recordings/recordingsViewProvider';
import { fileVisibilityEventEmitter, fileSelectionEventEmitter, nodeSelectionEventEmitter, reloadEventEmitter } from '../../eventEmitter';
import { EditorUtils } from './editorUtils';
import { TreeNodeDataAR } from '../../state/activeRecord/treeNodeDataAR';
import { DocumentActionRegistration } from './documentActionRegistration';
import { Mutex } from 'async-mutex';
import { CurrentState } from '../../state/currentState';
import { TracedFile } from './tracedFile';
import { DecorationManager } from './editorDecorations';

/**
 * Manages document-related operations and coordinates decorations across multiple files
 */
export class DocumentManager {
  private static highlightMutex: Mutex = new Mutex();
  // Registry for decoration managers to ensure one instance per URI
  private static decorationManagers: Map<string, DecorationManager> = new Map();

  constructor(
    private localsDataProvider: RecordingsTreeProvider,
    private docAReg: DocumentActionRegistration,
  ) {
    this.docAReg = docAReg;
    reloadEventEmitter.event(() => {
      this.redecorateVisibleEditors();
    });
    nodeSelectionEventEmitter.event(async ({ prevNode, node }) => {
      await this.undecorateNode(prevNode);
      const editors = await this.openResourceByTreeNode(node);
      await this.decorate(editors);
    });
    fileSelectionEventEmitter.event(async ({ uri, prevNode }) => {
      await this.undecorateNode(prevNode);
      await this.revealNodeByUri(uri);
    });
    fileVisibilityEventEmitter.event(() => {
      // Event handler intentionally left empty
    });
  }

  /**
   * Gets or creates a DecorationManager for the specified URI
   * @param uri The URI to get a DecorationManager for
   * @returns The DecorationManager for the URI
   */
  static getDecorationManager(uri: vscode.Uri): DecorationManager {
    const uriString = uri.toString();
    let decorationManager = this.decorationManagers.get(uriString);
    
    if (!decorationManager) {
      decorationManager = new DecorationManager(uri);
      this.decorationManagers.set(uriString, decorationManager);
    }
    
    return decorationManager;
  }

  initialize(): void {
    try {
      this.decorate(vscode.window.visibleTextEditors);
    } catch (error) {}
  }

  async revealNodeByUri(uri: vscode.Uri): Promise<vscode.TextEditor[]> {
    const file = new TracedFile(uri);
    const lineToScrollTo = 1; // Default to first line
    file.scrollToLine(lineToScrollTo);
    return EditorUtils.openResource(file.uri, lineToScrollTo, this.docAReg);
  }

  async openResourceByTreeNode(node: TreeNodeDataAR): Promise<vscode.TextEditor[]> {
    const filePath = node.getFile();
    if (filePath === "") {
      return [];
    }

    const uri = vscode.Uri.file(filePath);
    const file = new TracedFile(uri);
    const lineNumber = parseInt(node.getLine());
    const lineToScrollTo = isNaN(lineNumber) ? 1 : lineNumber;
    file.scrollToLine(lineToScrollTo);
    return EditorUtils.openResource(file.uri, lineToScrollTo, this.docAReg);
  }

  /**
   * Decorates editors based on the current state
   * @param editors The editors to decorate
   */
  async decorate(editors: readonly vscode.TextEditor[]): Promise<void> {
    const uris = new Set(editors.map(editor => editor.document.uri));
    const files = Array.from(uris).map(uri => new TracedFile(uri));
    
    for (const file of files) {
      let node: TreeNodeDataAR | undefined = undefined;
      if (CurrentState.matches(file)) {
        node = CurrentState.currentNode() as TreeNodeDataAR;
      }
      
      // This mutex prevents race conditions when decorating
      await DocumentManager.highlightMutex.runExclusive(async () => {
        await this.decorateFile(file, node);
      });
    }
  }

  /**
   * Decorates a single file based on the node
   * @param file The file to decorate
   * @param node The node to use for decoration
   */
  private async decorateFile(file: TracedFile, node: TreeNodeDataAR | undefined): Promise<void> {
    const filePath = file.uri.fsPath;
    const decorationManager = DocumentManager.getDecorationManager(file.uri);
    
    if (node && node.getFile() === filePath) {
      // If this is a method node, highlight the method
      if (!node.getIsScript()) {
        await this.highlightMethod(file, node);
      }
    } else {
      // Clear any method highlighting
      await decorationManager.dispose();
    }
  }

  /**
   * Highlights a method in a file based on the node
   * @param file The file containing the method
   * @param node The node representing the method
   */
  private async highlightMethod(file: TracedFile, node: TreeNodeDataAR): Promise<void> {
    const line = parseInt(node.getLine());
    if (isNaN(line) || line <= 0) {
      return;
    }
    
    // Try to use the language server to get method boundaries
    const decorationManager = DocumentManager.getDecorationManager(file.uri);
    await decorationManager.highlightMethodUsingLanguageServer(line);
  }

  /**
   * Removes decorations for a node
   * @param node The node to undecorate
   */
  async undecorateNode(node: TreeNodeDataAR | null): Promise<void> {
    if (!node) {
      return;
    }
    
    const editor = vscode.window.visibleTextEditors.find(editor => 
      editor.document.uri.fsPath === node.getFile()
    );
    
    if (editor) {
      const file = new TracedFile(editor.document.uri);
      // Clear any method highlighting
      const decorationManager = DocumentManager.getDecorationManager(file.uri);
      await decorationManager.dispose();
      await this.decorate([editor]);
    }
  }

  /**
   * Redecorates all visible editors
   */
  async redecorateVisibleEditors(): Promise<void> {
    const editors = vscode.window.visibleTextEditors;
    await this.decorate(editors);
  }
}