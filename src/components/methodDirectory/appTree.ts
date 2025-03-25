import { RootNodeData, DirNodeData, ClassNodeData, FileNodeData, MethodNodeData } from './generators/nodeData';
import { FileTreeGenerator } from './generators/fileTreeGenerator';
import { AppFileTreeGenerator } from './generators/appFileTreeGenerator';
import { NodeSourceAR } from '../../state/activeRecord/nodeSourceAR';

export class AppTree {
  private _currentId: number = 0;
  private _generators: FileTreeGenerator[] = [];
  private _populate!: Promise<void>;
  public appFileTree!: AppFileTreeGenerator;
  public fileNodes: FileNodeData[];
  public classNodes: ClassNodeData[];
  public methodNodes: MethodNodeData[];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor() {
    this.fileNodes = [];
    this.classNodes = [];
    this.methodNodes = [];
  }

  public topLevelNodes(): Promise<(RootNodeData | DirNodeData)[]> {
    return this._populate.then(() => {
      return this._generators.map(generator => generator.root);
    }).catch(() => {
      return [];
    });
  }

  nextId = (): string => {
    return (this._currentId++).toString();
  };

  public populateTree(): Promise<void> {
    this._populate = NodeSourceAR.loadAll().then(() => {
      this.buildGenerators();
      return Promise.all(this._generators.map(generator => {
        return generator.populateTree();
      }));
    }).then(() => {
      this._generators.forEach(generator => {
        generator.finalize();
        this.fileNodes = this.fileNodes.concat(generator.allFileNodes);
        this.classNodes = this.classNodes.concat(generator.allClassNodes);
        this.methodNodes = this.methodNodes.concat(generator.allMethodNodes);
      });
    }).catch((error) => {
      console.error('Error populating tree:', error);
      throw error;
    });
    return this._populate;
  }

  getNodeByFile(file: string):  FileNodeData | undefined {
    return this.fileNodes.find(fileNode => fileNode.file === file);
  }

  getNodeByMethod(file: string, method: string):  MethodNodeData | null {
    return this.methodNodes.find(methodNode =>
      methodNode.file === file && methodNode.method === method
    ) || null;
  }

  getNodeByFileAndLine(file: string, line: number):  MethodNodeData | null {
    return this.methodNodes.find(methodNode => {
      return methodNode.file === file && methodNode.line === String(line);
    }) || null;
  }

  private buildGenerators(): void {
    this.appFileTree = new AppFileTreeGenerator(this);
    this._generators = [
      this.appFileTree
    ];
  }

  public static isLineInMethod(methodNode: MethodNodeData, file: string, line: number): boolean {
    return methodNode.file === file && methodNode.line === String(line);
  }
}