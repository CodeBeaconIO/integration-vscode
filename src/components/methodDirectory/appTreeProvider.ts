import * as vscode from 'vscode';
import { MissingDbError } from '../../state/db/sqliteConnection';
import { DirNodeData, FileNodeData, ClassNodeData, MethodNodeData, DefinedClassNodeData, NodeData } from './generators/nodeData';
import { TreeItemFactory } from '../methodDirectory/treeItemFactory';
import { reloadEventEmitter } from '../../eventEmitter';
import { AppTree } from './appTree';

export class AppTreeProvider implements vscode.TreeDataProvider<NodeData> {
  public appTree: AppTree;
  private _populate: Promise<void>;
  private _dataPopulated: boolean = false;
  private _initialLoad: boolean = true;
  private _onDidChangeTreeData: vscode.EventEmitter<NodeData | undefined | null | void> = new vscode.EventEmitter<NodeData | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<NodeData | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {
    this.appTree = new AppTree();
    this._populate = Promise.resolve();
    reloadEventEmitter.event(() => {
      this._dataPopulated = false;
      this.appTree = new AppTree();
      this._populate = this.populateData();
      this.refresh();
    });
  }

  getTreeItem(element: NodeData): vscode.TreeItem {
    //Ids should possibly be assigned here. Either that or create a class method here for generating them... or both.
    return TreeItemFactory.createTreeItem(element);
  }

  async getChildren(element?: NodeData): Promise<NodeData[]> {
    if (this._initialLoad) {
      return Promise.resolve([]);
    }
    try {
      if (element) {
        let children = [];
        if (element instanceof ClassNodeData) {
          children = this.insertDefinedClassNodes(element);
        } else {
          children = element.children ?? [];
        }
        if (element instanceof DirNodeData || element instanceof FileNodeData) {
          children.sort((a, b) => a.name.localeCompare(b.name));
        }
        return children;
      } else {
        return this._populate.then(() => {
          return this.appTree.topLevelNodes();
        });
      }
    } catch (error) {
      if (error instanceof MissingDbError) {
        return [];
      } else {
        throw error;
      }
    }
  }
  
  private insertDefinedClassNodes(element: ClassNodeData) {
    const methodNodes = element.children as MethodNodeData[];
    methodNodes.forEach(mNode => {
      if (mNode.parent?.name === mNode.definedClass) {
        mNode.definedClass = "";
      }
    });
    const sortedChildren = (element.children as MethodNodeData[])
      .sort((a, b) => {
        return a.definedClass.localeCompare(b.definedClass);
      });
    let currentDefinedClass = "";
    const children = sortedChildren.reduce((acc, node) => {
      if (node.definedClass !== currentDefinedClass) {
        currentDefinedClass = node.definedClass;
        if (currentDefinedClass !== node.parent?.name) {
          const newMethodNode = new DefinedClassNodeData({
            name: currentDefinedClass
          });
          acc.push(newMethodNode);
        }
      }
      acc.push(node);
      return acc;
    }, [] as (MethodNodeData | DefinedClassNodeData)[]);
    return children;
  }

  getParent(element:  NodeData): NodeData | null {
    // I dont' think this type check is necessary any more
    if ('parent' in element) {
      return element.parent;
    } else {
      return null;
    }
  }

  private async populateData(): Promise<void> {
    vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'loadingAppTree');

    if (this._dataPopulated) {
      return;
    }
    this._dataPopulated = true;
    return this.appTree.populateTree().then(() => {
      if (this._initialLoad) {
        const paths:string[] = [];
        this.getPaths(paths, this.appTree.appFileTree.root);
      }
    })
    .catch((error) => {
      console.error('Error in app tree initialization:', error);
    });
  }

  private getPaths(paths: string[], node: NodeData): void {
    if (node.file && paths.indexOf(node.file) === -1) {
      paths.push(node.file);
    }
    if (node.children) {
      node.children.forEach(child => {
        this.getPaths(paths, child);
      });
    }
  }

  private async _getAppNodeByLine(file: string, lineNumber: number): Promise<MethodNodeData | null> {
    const appSelection = this.appTree.methodNodes.filter(node => {
      return node.file === file && 
        node.line === String(lineNumber);
    });
    if (appSelection.length > 0) {
      return appSelection[0];
    }
    return null;
  }

  refresh(): void {
    this._initialLoad = false;
    this._onDidChangeTreeData.fire();
  }
}
