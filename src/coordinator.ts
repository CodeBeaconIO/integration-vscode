import * as vscode from 'vscode';
import { RecordingsTreeProvider } from './components/recordings/recordingsViewProvider';
import { fileVisibilityEventEmitter, documentVisibilityChangedEventEmitter, fileSelectionEventEmitter, nodeSelectionEventEmitter, editorSelectionEventEmitter, reloadEventEmitter } from './eventEmitter';
import { TreeNodeDataAR } from './state/activeRecord/treeNodeDataAR';
import { DocumentManager } from './components/editor/documentManager';
import { DocumentEvents } from './components/editor/documentEvents';
import { DocumentActionRegistration } from './components/editor/documentActionRegistration';
import { CurrentState } from './state/currentState';
import { TracedFile } from './components/editor/tracedFile';

export class Coordinator {
  private docAReg: DocumentActionRegistration;
  private documentManager: DocumentManager;

  constructor(
    RecordingsDataProvider: RecordingsTreeProvider,
  ) {
    this.docAReg = new DocumentActionRegistration();
    this.documentManager = new DocumentManager(RecordingsDataProvider, this.docAReg);
    new DocumentEvents();
    reloadEventEmitter.event(() => {
      TreeNodeDataAR.reconnectDb();
    });
    this.registerCommandHandlers();
    this.registerEventHandlers();
  }

  // Check if a database is selected
  private isDatabaseSelected(): boolean {
    return !!CurrentState.currentDbUri();
  }

  registerCommandHandlers() {
     vscode.commands.registerCommand('callTree.openFile', (treeNode) => {
      if (!this.isDatabaseSelected()) { return; };
      TreeNodeDataAR.findById(treeNode.getId()).then((node) => {
        const prevNode = CurrentState.currentNode();
        CurrentState.setCurrentNode(node!);
        nodeSelectionEventEmitter.fire({ prevNode: prevNode, node: node! });
      });
    });
    vscode.commands.registerCommand('appTree.openFile', (uri) => {
      if (!this.isDatabaseSelected()) { return; };
      const prevNode = CurrentState.currentNode();
      CurrentState.setCurrentNode(null);
      fileSelectionEventEmitter.fire({ uri: uri, prevNode: prevNode });
    });
    vscode.commands.registerCommand('appTree.openFileAtLine', (uri, line) => {
      if (!this.isDatabaseSelected()) { return; };
      const file = new TracedFile(uri);
      this.selectNodeByFileLocation(file, line);
    });
  }
  
  registerEventHandlers() {
    editorSelectionEventEmitter.event(({ uri, line }) => {
      if (!this.isDatabaseSelected()) { return; };
      const file = new TracedFile(uri);
      this.selectNodeByFileLocation(file, line);
    });

    documentVisibilityChangedEventEmitter.event(({ editors }) => {
      if (!this.isDatabaseSelected()) { return; };
      const notifyEditors: vscode.TextEditor[] = [];
      for(const editor of editors) {
        const uri = editor.document.uri;
        if (this.docAReg.hasPendingRevealForFile(uri.fsPath)) {
          this.docAReg.deregisterPendingDocumentOpen(uri);
          continue;
        } else {
          notifyEditors.push(editor);
        }
      }
      fileVisibilityEventEmitter.fire({ editors: notifyEditors });
    });
  }

  initialize() {
    this.documentManager.initialize();
  }

  async selectNodeByFileLocation(file: TracedFile, lineNumber: number) {
    const filePath = file.uri.fsPath;
    if (CurrentState.matches(filePath, lineNumber)) {
      return;
    } else if (this.docAReg.hasPendingRevealForFile(filePath)) {
      return;
    } else {
      const matchingItem = await TreeNodeDataAR.findByFileAndLine(filePath, lineNumber);
      if (matchingItem) {
        const prevNode = CurrentState.currentNode();
        CurrentState.setCurrentNode(matchingItem);
        nodeSelectionEventEmitter.fire({ prevNode: prevNode, node: matchingItem });
      } else {
        const prevNode = CurrentState.currentNode();
        CurrentState.setCurrentNode(null);
        fileSelectionEventEmitter.fire({ uri: file.uri, prevNode: prevNode});
      }
    }
  }
}