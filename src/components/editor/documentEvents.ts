import * as vscode from 'vscode';
import { documentVisibilityChangedEventEmitter, editorSelectionEventEmitter } from '../../eventEmitter';

export class DocumentEvents {

  constructor() {

    vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
        const editor = event.textEditor;
        // Editors can have muliple selections. '.selection' is the primary selection. '.active' is the cursor position.
        const currentLineNumber = editor.selection.active.line;
        const uri = editor.document.uri;
        editorSelectionEventEmitter.fire({ uri: uri, line: currentLineNumber + 1 });
      }
    });

    vscode.window.onDidChangeVisibleTextEditors(event => {
      documentVisibilityChangedEventEmitter.fire({ editors: event });
    });
  }
}