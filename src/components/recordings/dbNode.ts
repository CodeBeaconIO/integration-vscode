import * as vscode from 'vscode';

class DbNode extends vscode.TreeItem {
  name!: string;
  fileName!: string;
  dbPath: string;

  constructor(dbPath: string) {
    super('', vscode.TreeItemCollapsibleState.None);
    this.dbPath = dbPath;
    this.contextValue = 'recording';
  }

  setName(name: string): void {
    this.name = name;
    this.label = name;
  }

  setDescription(description: string): void {
    this.description = description;
    this.updateTooltip();
  }

  setFileName(fileName: string): void {
    this.fileName = fileName;
    this.updateCommand();
  }

  private updateTooltip(): void {
    if (!this.description) { return; }
    
    let obj;
    try {
      obj = JSON.parse(this.description as string);
      let markdownDescription = Object.entries(obj)
        .map(([key, value]) => `  "${key}": "${value}"`)
        .join(',\n');
      markdownDescription = `{\n${markdownDescription}\n}`;
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${markdownDescription}\n\`\`\``);
    } catch (error) {
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${this.description}\n\`\`\``);
    }
  }

  private updateCommand(): void {
    if (this.fileName) {
      this.command = { command: 'recordingsTree.loadDb', title: "Load Db", arguments: [this.fileName] };
    }
  }
}

class DbErrorNode extends vscode.TreeItem {
  dbFileName: string;

  constructor(
    dbFileName: string,
    fullPath: string
  ) {
    super("Error loading database", vscode.TreeItemCollapsibleState.None);
    this.dbFileName = dbFileName;
    this.description = dbFileName;
    this.tooltip = `Database file exists but could not be loaded: ${fullPath}`;
    this.contextValue = 'dbError';
    this.command = undefined;
  }
}
  
export { DbNode, DbErrorNode };
