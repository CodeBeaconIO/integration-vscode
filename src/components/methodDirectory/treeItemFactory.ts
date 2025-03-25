import * as vscode from 'vscode';
import { NodeData, RootNodeData, DirNodeData, FileNodeData, ClassNodeData, MethodNodeData, DefinedClassNodeData } from './generators/nodeData';
import { RootNode, DirNode, AppNode, ClassNode, DefinedClassNode, MethodNode } from './nodes';

export class TreeItemFactory {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static createTreeItem(element: NodeData): vscode.TreeItem {
    let item;
    switch (true) {
      case element instanceof RootNodeData:
      item = this.createRootNode(element);
      break;
      case element instanceof DirNodeData:
      item = this.createDirNode(element);
      break;
      case element instanceof FileNodeData:
      item = this.createAppNode(element);
      break;
      case element instanceof ClassNodeData:
      item = this.createClassNode(element);
      break;
      case element instanceof DefinedClassNodeData:
      item = this.createDefinedClassNode(element);
      break;
      case element instanceof MethodNodeData:
      item = this.createMethodNode(element);
      break;
      default:
      console.log(element);
      throw new Error("Unknown NodeData type");
    }
    return item;
  }

  private static createRootNode(element: RootNodeData): vscode.TreeItem {
    let collapsibleState = null;
    if (element.category === "app") {
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }
    const name = element.name || "";
    let description = "";
    if (element.methodCount >= 1) {
      description = `${element.methodCount} calls`;
    }
    return new RootNode({
      name: name,
      description: description,
      path: element.file,
      iconPath: "",
      collapsibleState: collapsibleState
    });
  }

  private static createDirNode(element: DirNodeData): vscode.TreeItem {
    const name = element.name || "";
    let description = "";
    if (element.methodCount >= 1) {
      description = `${element.methodCount} calls`;
    }
    return new DirNode({
      name: name,
      path: element.file,
      description: description,
      iconPath: ""
    });
  }

  private static createAppNode(element: FileNodeData): vscode.TreeItem {
    const fileName = (element.file || "").split("/").pop() || "";
    let description = "";
    if ((element.methodCount || 0) >= 1) {
      description = `${element.methodCount} calls`;
    }
    const tooltip = element.file || "";
    const uri = element.file ? vscode.Uri.parse(element.file) : undefined;
    return new AppNode({
      uri: uri,
      fileName: fileName,
      description: description,
      tooltip: tooltip
    });
  }

  private static createClassNode(element: ClassNodeData): vscode.TreeItem {
    let description = "";
    if ((element.methodCount || 0) >= 1) {
      description = `${element.methodCount} calls`;
    }
    const tooltip = element.file || "";
    const uri = element.file ? vscode.Uri.parse(element.file) : undefined;
    return new ClassNode({
      uri: uri,
      name: element.name,
      description: description,
      tooltip: tooltip,
    });
  }

  private static createDefinedClassNode(element: DefinedClassNodeData): vscode.TreeItem {
    const displayName = `-- ${element.name} --`;
    return new DefinedClassNode({
      name: displayName,
      description: "",
      tooltip: ""
    });
  }

  private static createMethodNode(element: MethodNodeData): vscode.TreeItem {
    let method = element.method;
    if (element.block) {
      method = "[block]";
    }
    if (element.duplicate || element.block) {
      method = `${method} (L. ${element.line})`;
    }
    let description = "";
    if ((element.methodCount ?? 0) > 1) {
      description = `executed ${element.methodCount} times`;
    }
    const tooltip = element.file || "";
    const uri = element.file ? vscode.Uri.parse(element.file) : undefined;
    const line = Number(element.line) || 0;
    return new MethodNode({
      uri: uri,
      line: line,
      block: element.block,
      method: method,
      description: description,
      tooltip: tooltip
    });
  }
}