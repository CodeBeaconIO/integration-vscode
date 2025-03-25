import { RootNodeData, DirNodeData, FileNodeData, ClassNodeData, MethodNodeData } from './nodeData';
import { AppTree } from '../appTree';
import { TreeNodeDataAR } from '../../../state/activeRecord/treeNodeDataAR';

// Define an interface for the database row structure
interface MethodRowData {
  id: string | number;
  tp_defined_class: string;
  method: string;
  name: string;
  block: number;
  line: number;
  method_count: string | number;
  file: string;
}

export interface MethodRow {
  file: string;
  method: string;
  method_count: number;
}

export abstract class FileTreeGenerator {
  static _path: string;
  protected _tree: AppTree;
  _root: RootNodeData;
  _topLevel: DirNodeData[] = [];
  _allDirNodes: DirNodeData[] = [];
  _allFileNodes: FileNodeData[] = [];
  _allClassNodes: ClassNodeData[] = [];
  _allMethodNodes: MethodNodeData[] = [];

  constructor(tree: AppTree, private parent: RootNodeData | DirNodeData | FileNodeData) {
    this._tree = tree;
    this._root = parent;
  }

  public get root(): RootNodeData {
    return this._root;
  }

  public get topLevel(): DirNodeData[] {
    return this._topLevel;
  }

  public get allFileNodes(): FileNodeData[] {
    return this._allFileNodes;
  }

  public get allClassNodes(): FileNodeData[] {
    return this._allClassNodes;
  }

  public get allMethodNodes(): MethodNodeData[] {
    return this._allMethodNodes;
  }

  protected _addDir(parent: RootNodeData | DirNodeData, id: () => string, file: string, name: string): DirNodeData {
    if (parent.children.find(child => child.name === name)) {
      return parent.children.find(child => child.name === name) as DirNodeData;
    } else {
      const dirNode = this.createDirNode(parent, this._tree.nextId(), file, name);
      parent.children.push(dirNode);
      this._allDirNodes.push(dirNode);
      if (parent.id === this.root.id) {
        this._topLevel.push(dirNode as DirNodeData);
      }
      return dirNode;
    }
  }

  private createDirNode(parent: RootNodeData | DirNodeData, id: string, file: string, dirName: string): DirNodeData {
    return new DirNodeData({
      id: id,
      parent: parent,
      name: dirName,
      category: this._root.category,
      file: file,
      root: false,
      children: []
    });
  }

  protected _addFile(parent: RootNodeData | DirNodeData, id: () => string, file: string, name: string): FileNodeData {
    if (parent.children.find(child => child.name === name)) {
      return parent.children.find(child => child.name === name) as FileNodeData;
    } else {
      const fileNode = this.createFileNode(parent, this._tree.nextId(), file, name);
      parent.children.push(fileNode);
      this._allFileNodes.push(fileNode);
      if (parent.id === this.root.id) {
        this._topLevel.push(fileNode as FileNodeData);
      }
      return fileNode;
    }
  }

  private createFileNode(parent: RootNodeData | DirNodeData, id: string, file: string, fileName: string): FileNodeData {
    return new FileNodeData({
      id: id,
      parent: parent,
      name: fileName,
      category: this._root.category,
      file: file,
      root: false,
      children: []
    });
  }

  abstract addClass(file: string, name: string): ClassNodeData;

  protected _addClass(parent: RootNodeData | DirNodeData, id: () => string, file: string, name: string): ClassNodeData {
    const classNode = this.createClassNode(parent, this._tree.nextId(), file, name);
    parent.children.push(classNode);
    this._allClassNodes.push(classNode);
    return classNode;
  }

  private createClassNode(parent: RootNodeData | DirNodeData, id: string, file: string, className: string): ClassNodeData {
    return new ClassNodeData({
      id: id,
      parent: parent,
      name: className,
      category: this._root.category,
      file: file,
      root: false,
      children: []
    });
  }

  public finalize(): void {
    this._root.children = this._topLevel;
  }

  abstract libName(filePath: string): string;
  abstract queryConditionForLib(filePath: string): string;
  abstract populateTree(): Promise<void[]>;

  public _populateTree(condition: string): Promise<void[]> {
    return TreeNodeDataAR.findAllMethodCountByClass(condition).then(classes => {
      const classMap = classes.reduce((map, { file, className }) => {
        const relativeFilePath = this.libName(file);
        const key = `${relativeFilePath}:${className}`;
        if (!map.has(key)) {
          map.set(key, this.addClass(file, className));
        }
        return map;
      }, new Map<string, ClassNodeData>());
      return classMap;
    }).then(map => {
      return Promise.all(Array.from(map.values()).map(async (classNode) => {
        return await this.getMethodNodesByClass(classNode, this.queryConditionForLib(classNode.file));
      }));
    });
  }

  async getMethodNodesByClass(classNode: ClassNodeData, condition: string): Promise<void> {
    const origMethodNodes = await this.getNodesByClass(condition, classNode.name, classNode.category);
    const methodNodes = origMethodNodes.filter(node => !(node.block && node.method && node.method !== ""));
    const methodNames = methodNodes.map(node => node.method);
    const duplicateMethodNames = methodNames.filter((name, index) => methodNames.indexOf(name) !== index);
    
    methodNodes.forEach((methodNode) => {
      methodNode.parent = classNode;
      methodNode.id = this._tree.nextId();
      if (duplicateMethodNames.includes(methodNode.method)) {
        methodNode.duplicate = true;
      }
      this._allMethodNodes.push(methodNode);
    });
    classNode.children = methodNodes;
  }

  private getNodesByClass(condition: string, className: string, category: string):  Promise<MethodNodeData[]> {
    // TODO this either needs to filter by file as well or I need to extract the definedClass name earlier and use that. TBH, I'm not sure what I want the behavior to be. I think probably eventually I could have both views: one where the class is higher level and all methods are children even if they come from different files. Currently, though, I'm using a file directory as the primary view and so will only show methods in a class that were defined (or actually called) from within that file. So I think that I want to filter by file.
    // ^ Tentative conclusion above is to try filter by file first
    const query = `SELECT MIN(id) as id, file, tp_defined_class, method, block, line, COUNT(*) as method_count
      FROM treenodes
      WHERE ${condition} AND tp_class_name = '${className}'
      GROUP BY file, method, block, line
      ORDER BY id ASC`;
    return new Promise((resolve, reject) => {
      TreeNodeDataAR._all(query)
        .then(rows => {
          const nodes: MethodNodeData[] = [];
          // Map the rows to MethodRowData objects with proper type checking
          const methodRows = rows.map(row => ({
            id: row.id as string | number,
            tp_defined_class: row.tp_defined_class as string,
            method: row.method as string,
            name: row.name as string,
            block: row.block as number,
            line: row.line as number,
            method_count: row.method_count as string | number,
            file: row.file as string
          }));
          
          methodRows.forEach((row: MethodRowData) => {
            let tpDefinedClass = row.tp_defined_class;
            if (ArrayBuffer.isView(tpDefinedClass)) {
              const decoder = new TextDecoder();
              tpDefinedClass = decoder.decode(((tpDefinedClass as unknown) as ArrayBuffer));
            }
            const node: MethodNodeData = new MethodNodeData({
              id: String(row.id),
              category: category,
              file: row.file,
              definedClass: tpDefinedClass,
              method: row.method,
              name: row.name,
              block: row.block === 1,
              line: String(row.line),
              methodCount: typeof row.method_count === 'string' ? parseInt(row.method_count, 10) : row.method_count,
              parent: null
            });
            nodes.push(node);
          });
          resolve(nodes);
        })
        .catch(error => {
          reject(error);
      });
    });
  }
}