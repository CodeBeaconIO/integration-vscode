import * as vscode from 'vscode';
import { DocumentActionRegistration } from './documentActionRegistration';

export interface lineRange {
  line: number;
  start?: number;
  end?: number;
}

export class EditorUtils {
  static openResource(uri: vscode.Uri, line: number | null, docAReg: DocumentActionRegistration, options: Record<string, unknown> = {}): Promise<vscode.TextEditor[]> {
    const editors: vscode.TextEditor[] = [];
    return new Promise<vscode.TextEditor>((resolve) => {
      const activeDocument = vscode.window.activeTextEditor?.document;
      if (activeDocument && activeDocument.uri.toString() === uri.toString()) {
        resolve(vscode.window.activeTextEditor as vscode.TextEditor);
      } else {
        const visibleEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri.toString());
        if (visibleEditor) {
          resolve(visibleEditor);
          // resolve(vscode.window.showTextDocument(visibleEditor.document, options));
        } else {
          docAReg.registerPendingDocumentOpen(uri);
          vscode.workspace.openTextDocument(uri).then(document => {
            resolve(vscode.window.showTextDocument(document, options));
          });
        }
      }
    }).then( (editor) => {
      const document = editor.document;
      let revealRange: vscode.Range | null = null;

      if (line && line <= document.lineCount) {
        // const position = new vscode.Position(line - 1, 0);
        // _editor.selection = new vscode.Selection(position, position);
        if (line < editor.visibleRanges[0].start.line || line > editor.visibleRanges[0].end.line) {
          revealRange = document.lineAt(line).range;
        }
      } else {
        // vscode.window.showErrorMessage(`No valid line number or lines executed.`);`
      }
// This should not be handling highlighting nor revealing the line
      this.getOpenEditors(uri).forEach(editor => {
        editors.push(editor);
        if (revealRange) {
          editor.revealRange(revealRange, vscode.TextEditorRevealType.InCenter);
        }
      });
      return editors;
    }, (openDocumentError) => {
      // Handle errors in opening the document
      vscode.window.showErrorMessage(`Could not open file: ${uri.fsPath}. Error: ${openDocumentError.message}`);
      return editors;
    });
  }

  static getOpenEditors(uri: vscode.Uri): vscode.TextEditor[] {
    const openEditors: vscode.TextEditor[] = [];

    vscode.window.visibleTextEditors.forEach(editor => {
      if (editor.document.uri.toString() === uri.toString()) {
        openEditors.push(editor);
      }
    });

    return openEditors;
  }

  static getlineToScrollTo(lineNumber: string, lineRanges: lineRange[], otherLinesExecuted: number[]): number | null {
    if (lineNumber === "") {
      return null;
    }
    const lineNum = parseInt(lineNumber);
    if (isNaN(lineNum)) {
      return null;
    }
    
    // If we have a valid line number, use it
    if (lineNum > 0) {
      return lineNum;
    }
    
    // Otherwise, try to find a nearby line from the method ranges
    const linesExecuted = lineRanges.map(range => range.line);
    
    if (linesExecuted.length > 0) {
      return linesExecuted[0];
    }
    
    if (otherLinesExecuted.length > 0) {
      return otherLinesExecuted[0];
    }
    
    return null;
  }
}