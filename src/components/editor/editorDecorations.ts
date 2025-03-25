import * as vscode from 'vscode';

export class DecorationManager {
  private uri: vscode.Uri;
  private readonly methodHighlightBackground: string = 'rgba(100, 200, 255, 0.1)';
  private readonly methodHighlightDecor = vscode.window.createTextEditorDecorationType({
    backgroundColor: this.methodHighlightBackground,
    isWholeLine: true
  });

  constructor(uri: vscode.Uri) {
    this.uri = uri;
  }

  private editors(): vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter(editor => editor.document.uri.toString() === this.uri.toString());
  }

  /**
   * Disposes all decorations and resources
   */
  async dispose(): Promise<void> {
    this.clearDecorations();
  }

  /**
   * Clears all method highlight decorations
   */
  private clearDecorations(): void {
    for (const editor of this.editors()) {
      editor.setDecorations(this.methodHighlightDecor, []);
    }
  }

  /**
   * Highlights a method from start line to end line
   * @param startLine The 1-indexed start line
   * @param endLine The 1-indexed end line
   */
  highlightMethod(startLine: number, endLine: number): void {
    if (startLine <= 0 || endLine <= 0) {
      return;
    }
    
    for (const editor of this.editors()) {
      if (endLine <= editor.document.lineCount) {
        // Clear previous decorations
        this.clearDecorations();
        
        // Create ranges for each line in the method
        const ranges: vscode.Range[] = [];
        for (let i = startLine - 1; i < endLine; i++) {
          const line = editor.document.lineAt(i);
          ranges.push(line.range);
        }
        
        // Apply the method highlight decoration to all lines
        editor.setDecorations(this.methodHighlightDecor, ranges);
      }
    }
  }

  /**
   * Highlights a method containing the specified line using language server information
   * @param lineNumber The 1-indexed line number
   */
  async highlightMethodUsingLanguageServer(lineNumber: number): Promise<void> {
    if (lineNumber <= 0) {
      return;
    }
    
    for (const editor of this.editors()) {
      if (lineNumber <= editor.document.lineCount) {
        const lineIndex = lineNumber - 1;
        
        // Clear any existing decorations
        this.clearDecorations();
        
        // Try to find method boundaries using document symbols
        try {
          const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            editor.document.uri
          );
          
          if (symbols && symbols.length > 0) {
            // Find the method that contains this line
            const methodSymbol = this.findMethodSymbolAtLine(symbols, lineIndex);
            
            if (methodSymbol) {
              // We found the method, now highlight it
              const startLine = methodSymbol.range.start.line + 1; // Convert to 1-indexed
              const endLine = methodSymbol.range.end.line + 1; // Convert to 1-indexed
              
              this.highlightMethod(startLine, endLine);
              return;
            }
          }
        } catch (error) {
          console.error('Error getting document symbols:', error);
        }
        
        // If we couldn't find the method boundaries, just highlight the single line
        const currentLine = editor.document.lineAt(lineIndex);
        editor.setDecorations(this.methodHighlightDecor, [currentLine.range]);
      }
    }
  }
  
  /**
   * Finds a method symbol at a specific line
   * @param symbols The document symbols to search
   * @param lineIndex The 0-indexed line number
   * @returns The method symbol or undefined if not found
   */
  private findMethodSymbolAtLine(symbols: vscode.DocumentSymbol[], lineIndex: number): vscode.DocumentSymbol | undefined {
    for (const symbol of symbols) {
      // Check if this symbol contains the line
      if (symbol.range.start.line <= lineIndex && symbol.range.end.line >= lineIndex) {
        // If this is a method, return it
        if (symbol.kind === vscode.SymbolKind.Method || 
            symbol.kind === vscode.SymbolKind.Function) {
          return symbol;
        }
        
        // Otherwise, check its children
        if (symbol.children?.length > 0) {
          const childSymbol = this.findMethodSymbolAtLine(symbol.children, lineIndex);
          if (childSymbol) {
            return childSymbol;
          }
        }
      }
    }
    
    return undefined;
  }
}
