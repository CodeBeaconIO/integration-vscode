class NodeData {
  id: string;
  category: string;
  file: string;
  name: string;
  children: (DirNodeData | FileNodeData | ClassNodeData | DefinedClassNodeData | MethodNodeData)[] = [];
  parent: RootNodeData | DirNodeData | FileNodeData | null;
  _methodCount: number | null = null;

  constructor(data: {
    id: string;
    category: string;
    file: string;
    name: string;
    children: (DirNodeData | FileNodeData | ClassNodeData | DefinedClassNodeData | MethodNodeData)[];
    parent: RootNodeData | DirNodeData  | FileNodeData | ClassNodeData | null;
  }) {
    this.id = data.id;
    this.category = data.category;
    this.file = data.file;
    this.name = data.name;
    this.children = data.children;
    this.parent = data.parent;
  }

  get methodCount(): number {
    if (this._methodCount === null) {
      this._methodCount = this.children.reduce((total, child) => {
        return total + child.methodCount;
      }, 0);
    }
    return this._methodCount;
  }
}

class RootNodeData extends NodeData {
  constructor(data: {
    id: string;
    name: string;
    category: string;
    file: string;
    children: DirNodeData[] | FileNodeData[];  
  }) {
    super({
      id: data.id,
      category: data.category,
      file: data.file,
      name: data.name,
      children: data.children,
      parent: null
    });
  }
}

class DirNodeData extends NodeData {
  root: boolean;

  constructor(data: {
    id: string;
    parent: RootNodeData | DirNodeData;
    name: string;
    category: string;
    file: string;
    root: boolean;
    children: (DirNodeData | FileNodeData | ClassNodeData)[];
  }) {
    super({
      id: data.id,
      category: data.category,
      file: data.file,
      name: data.name,
      children: data.children,
      parent: data.parent
    });
    this.root = data.root;
  }
}

class FileNodeData extends NodeData {
  root: boolean;

  constructor(data: {
    id: string;
    parent: RootNodeData | DirNodeData;
    name: string;
    category: string;
    file: string;
    root: boolean;
    children: ClassNodeData[];
  }) {
    super({
      id: data.id,
      category: data.category,
      file: data.file,
      name: data.name,
      children: data.children,
      parent: data.parent
    });
    this.root = data.root;
  }
}

class ClassNodeData extends NodeData {
  root: boolean;

  constructor(data: {
    id: string;
    parent: RootNodeData | DirNodeData;
    name: string;
    category: string;
    file: string;
    root: boolean
    children: MethodNodeData[];
  }) {
    super({
      id: data.id,
      category: data.category,
      file: data.file,
      name: data.name,
      children: data.children,
      parent: data.parent
    });
    this.root = data.root;
  }
}

class DefinedClassNodeData extends NodeData {
  constructor(data: {
    name: string;
  }) {
    super({
      id: '',
      category: '',
      file: '',
      name: data.name,
      children: [],
      parent: null
    });
  }
}

class MethodNodeData extends NodeData {
  definedClass: string;
  method: string;
  block: boolean;
  line: string;
  duplicate: boolean = false;

  constructor(data: {
    id: string;
    category: string;
    file: string;
    definedClass: string;
    methodCount: number;
    method: string;
    name: string;
    block: boolean;
    line: string;
    parent: FileNodeData | null;  //remove null if possible
  }) {
    super({
      id: data.id,
      category: data.category,
      file: data.file,
      name: data.name,
      parent: data.parent,
      children: []
    });
    this.definedClass = data.definedClass;
    this.method = data.method;
    this.block = data.block;
    this.line = data.line;
    this._methodCount = data.methodCount;
  }
}

export { NodeData, RootNodeData, DirNodeData, ClassNodeData, DefinedClassNodeData, FileNodeData, MethodNodeData};
