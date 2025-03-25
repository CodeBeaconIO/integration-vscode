import * as vscode from 'vscode';

class DbNode extends vscode.TreeItem {
  name: string;
  description: string;
  dbFileName: string;

  constructor(
    name: string,
    description: string,
    dbFileName: string,
    // collapsibleState?: vscode.TreeItemCollapsibleState 
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.name = name;
    this.label = name;
    this.description = description;

    let obj;
    try {
      obj = JSON.parse(description);
      let markdownDescription = Object.entries(obj)
        .map(([key, value]) => `  "${key}": "${value}"`)
        .join(',\n');
      markdownDescription = `{\n${markdownDescription}\n}`;
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${markdownDescription}\n\`\`\``);
    } catch (error) {
      // this.tooltip = new vscode.MarkdownString(description);
      this.tooltip = new vscode.MarkdownString(`\`\`\`json\n${description}\n\`\`\``);
    }
    this.dbFileName = dbFileName;
    this.command = { command: 'recordingsTree.loadDb', title: "Load Db", arguments: [this.dbFileName], };
    // this.contextValue = 'file';
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
