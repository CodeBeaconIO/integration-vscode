import { FileTreeGenerator } from './fileTreeGenerator';
import { AppTree } from '../appTree';
import { NodeSourceAR } from '../../../state/activeRecord/nodeSourceAR';
import { RootNodeData, ClassNodeData } from './nodeData';
import * as path from 'path';

export class AppFileTreeGenerator extends FileTreeGenerator {
  setsMethodNodes = true;
  _populate!: Promise<void>;

  static get rootPath(): string {
    return this._path || NodeSourceAR.getByName('app').rootPath;
  }

  constructor(tree: AppTree) {
    const projectName = path.basename(AppFileTreeGenerator.rootPath);
    const root = new RootNodeData({
      id: tree.nextId(),
      name: projectName,
      category: "app",
      file: AppFileTreeGenerator.rootPath,
      children: [],
    });
    super(tree, root);
  }

  public libName(filePath: string): string {
    const regex = new RegExp(`^${AppFileTreeGenerator.rootPath}${path.sep}`);
    return filePath.replace(regex, '');
  }

  public queryConditionForAll(): string {
    return `file LIKE '${AppFileTreeGenerator.rootPath}%'`;
  }

  public queryConditionForLib(filePath: string): string {
    return `file = '${filePath}'`;
  }

  public populateTree(): Promise<void[]> {;
    return super._populateTree(this.queryConditionForAll());
  }

  addClass(file: string, name: string): ClassNodeData {
    const relativeFilePath = this.libName(file);
    const pathParts = path.normalize(relativeFilePath).split(path.sep);
    let currentNode = this._root;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const dir = pathParts[i];
      currentNode = super._addDir(currentNode, this._tree.nextId, file, dir);
    }
    const fileName = pathParts[pathParts.length - 1];
    currentNode = super._addFile(currentNode, this._tree.nextId, file, fileName);

    const classNode = super._addClass(currentNode, this._tree.nextId, file, name);
    
    return classNode;
  }
}