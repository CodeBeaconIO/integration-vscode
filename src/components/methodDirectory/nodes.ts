import * as vscode from 'vscode';

class RootNode extends vscode.TreeItem {
  constructor({
    name,
    description,
    path,
    collapsibleState = vscode.TreeItemCollapsibleState.Expanded,
  }: {
    name: string,
    description: string;
    path: string;
    iconPath: string;
    collapsibleState?: vscode.TreeItemCollapsibleState | null;
  }) {
    super(name, collapsibleState || vscode.TreeItemCollapsibleState.Collapsed);
    this.description = description;
    this.contextValue = 'Folder';
    this.resourceUri = path ? vscode.Uri.file(path) : undefined;
    this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
  }
}

class DirNode extends vscode.TreeItem {
  constructor({
    name,
    description,
    path,
  }: {
    name: string,
    description: string;
    path: string;
    iconPath: string;
  }) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);
    this.description = description;
    this.contextValue = 'folder';
    this.resourceUri = path ? vscode.Uri.parse(path) : undefined;
  }
}

class AppNode extends vscode.TreeItem {
  constructor({
    uri,
    fileName,
    description,
    tooltip
  }: {
    uri: vscode.Uri | undefined;
    fileName: string;
    description: string;
    tooltip: string;
  }) {
    super(fileName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = description;
    this.tooltip = tooltip;
    if (uri) {
      this.command = { command: 'appTree.openFile', title: "Open File", arguments: [uri], };
    }
    this.contextValue = 'file';
    this.resourceUri = uri;
    this.iconPath = new vscode.ThemeIcon('file');
  }
}

class ClassNode extends vscode.TreeItem {
  constructor({
    uri,
    name,
    description,
    tooltip,
  }: {
    uri: vscode.Uri | undefined;
    name: string;
    description: string;
    tooltip: string;
  }) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);
    this.description = description;
    this.tooltip = tooltip;
    const line = 0;
    if (uri) {
      this.command = { command: 'appTree.openFileAtLine', title: "Open Class", arguments: [uri, line], };
    }
    this.iconPath = new vscode.ThemeIcon('symbol-class');
  }
}

class DefinedClassNode extends vscode.TreeItem {
  constructor({
    name,
    description,
    tooltip,
  }: {
    name: string;
    description: string;
    tooltip: string;
  }) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon('symbol-interface');
  }
}

class MethodNode extends vscode.TreeItem {
  constructor({
    uri,
    line,
    block,
    method,
    description,
    tooltip
  }: {
    uri: vscode.Uri | undefined;
    line: number;
    block: boolean;
    method: string;
    description: string;
    tooltip: string;
  }) {
    super(method, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = tooltip;
    this.command = { command: 'appTree.openFileAtLine', title: "Open File", arguments: [uri, line], };
    this.contextValue = 'file';
    this.iconPath = block
      ? new vscode.ThemeIcon('json', new vscode.ThemeColor('charts.yellow'))
      : new vscode.ThemeIcon('symbol-method');
  }
}
  
export { RootNode, DirNode, ClassNode, DefinedClassNode, AppNode, MethodNode };
