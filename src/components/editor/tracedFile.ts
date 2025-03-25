import * as vscode from 'vscode';

/**
 * Represents a file in the project that is being traced.
 * This class focuses on file representation and access, not decoration logic.
 */
export class TracedFile {
  private _uri: vscode.Uri;

  constructor(editor: vscode.TextEditor);
  constructor(uri: vscode.Uri);
  constructor(uriOrEditor: vscode.TextEditor | vscode.Uri) {
    let uri;
    if ('document' in uriOrEditor) {
      uri = uriOrEditor.document.uri;
    } else if (uriOrEditor instanceof vscode.Uri) {
      uri = uriOrEditor;
    } else {
      throw new Error('Invalid argument type');
    }
    this._uri = uri;
  }

  /**
   * Gets the URI of this file
   */
  get uri(): vscode.Uri {
    return this._uri;
  }

  /**
   * Gets all visible editors for this file
   */
  get visibleEditors(): vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter(editor => editor.document.uri.toString() === this.uri.toString());
  }

  /**
   * Gets the document for this file
   */
  get document(): vscode.TextDocument {
    return vscode.workspace.textDocuments.find(doc => doc.uri.toString() === this.uri.toString()) as vscode.TextDocument;
  }

  /**
   * Scrolls to the specified line in the first visible editor for this file
   * @param line The 1-indexed line number to scroll to
   */
  scrollToLine(line: number): void {
    const editors = this.visibleEditors;
    if (editors.length === 0) {
      return;
    }
    const editor = editors[0];
    editor.revealRange(new vscode.Range(line - 1, 0, line - 1, 0), vscode.TextEditorRevealType.InCenter);
  }
}