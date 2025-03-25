import * as vscode from 'vscode';
import { TreeNodeDataAR } from '../../state/activeRecord/treeNodeDataAR';
import { Mutex } from 'async-mutex';

export class DocumentActionRegistration {

  private registerMutex = new Mutex();
  private registeredDocuments = new Map<vscode.Uri, Mutex>();
  private pendingReveal: TreeNodeDataAR[];
  private pendingDocumentOpen: vscode.Uri[];

  constructor(
  ) {
    this.pendingReveal = [];
    this.pendingDocumentOpen = [];
  }
  // The purpose of this is to not trigger recursive events when programatically opening a document in response to previous events. WE only want events triggered on user actions
  registerPendingDocumentOpen(uri: vscode.Uri) {
    this.pendingDocumentOpen.push(uri);
  }

  deregisterPendingDocumentOpen(uri: vscode.Uri) {
    this.pendingDocumentOpen = this.pendingDocumentOpen.filter(item => item.fsPath !== uri.fsPath);
  }

  pendingDocumentOpenIncludes(uri: vscode.Uri) {
    return this.pendingDocumentOpen.some(item => item.toString() === uri.toString());
  }

  registerPendingReveal(node: TreeNodeDataAR) {
    this.pendingReveal.push(node);
  };

  deregisterPendingReveal(node: TreeNodeDataAR) {
    this.pendingReveal = this.pendingReveal.filter(item => item.getId() !== node.getId());
  }

  pendingRevealIncludes(node: TreeNodeDataAR) {
    return this.pendingReveal.includes(node);
  }

  hasPendingRevealForFile(file: string) {
    return this.pendingReveal.some(node => node.getFile() === file);
  }

  // This is to prevent what is supposed to be a single action (with multiple asynchronous steps) from getting executed multiple times when a user action is performed multiple times quickly. An example of this is a single document modification. Often an immediate subsequent modification event is triggered via auto formatting plugins.
  async register(uri: vscode.Uri, callback: () => Promise<void>) {
    await this.registerMutex.runExclusive(async () => {
      let mutex = this.registeredDocuments.get(uri);
      if (mutex === undefined) {
        mutex = new Mutex();
        this.registeredDocuments.set(uri, mutex);
      }
      if (mutex.isLocked()) {
        return false;
      } else {
        const releaseMutex = await mutex.acquire();
        try {
          await callback();
        } finally {
          releaseMutex();
        }
      } 
    });
  }

  deregister(uri: vscode.Uri) {
    this.registeredDocuments.delete(uri);
  }
}