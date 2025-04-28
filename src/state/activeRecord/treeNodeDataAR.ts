import * as vscode from 'vscode';
import { SQLiteConnection } from '../db/sqliteConnection';
import { SQLiteExecutor } from '../../services/sqlite/SQLiteExecutor';
import { lineRange } from '../../components/editor/editorUtils';
import { NodeSourceAR } from './nodeSourceAR';

export interface TreeNodeDataARInterface {
  id: string,
  file: string,
  line: string,
  method: string,
  depth: number,
  gemEntry: 0 | 1,
  isDepthTruncated: 0 | 1,
  parent_id: string | null,
  block: 0 | 1,
  caller: string,
  return_value: string,
  script: 0 | 1,
  tp_class_name: string | null
}

export class TreeNodeDataAR {
  private static _executor: SQLiteExecutor;
  private row: TreeNodeDataARInterface;
  private sourceName: string | null = null;
  private _callerLine: number | null = null;
  private static _findAllChildrenCache: Map<string | null, TreeNodeDataAR[]> = new Map<string | null, TreeNodeDataAR[]>();
  private static _findByIdCache: Map<string, TreeNodeDataAR> = new Map<string, TreeNodeDataAR>();
  static _nullObject: TreeNodeDataARInterface = {
    id: '',
    file: '',
    line: '',
    method: '',
    depth: 0,
    gemEntry: 0,
    isDepthTruncated: 0,
    parent_id: null,
    block: 0,
    caller: '',
    return_value: '',
    script: 0,
    tp_class_name: null
  };

  constructor(
    row: TreeNodeDataARInterface
  ) {
    this.row = row;
    this._generateSourceName();
  }

  static nullObject(): TreeNodeDataAR {
    return new TreeNodeDataAR(TreeNodeDataAR._nullObject);
  }

  private static executor(): SQLiteExecutor {
    if (TreeNodeDataAR._executor) {
      return this._executor;
    } else {
      this._executor = SQLiteConnection.getExecutor();
      return this._executor;
    }
  }

  public static reconnectDb(testExecutor?: SQLiteExecutor): void {
    this._clearCache();
    this._executor = testExecutor || SQLiteConnection.getExecutor();
  }

  private static _clearCache(): void {
    this._findAllChildrenCache.clear();
    this._findByIdCache.clear();
  }

  getMethod(): string {
    return this.row.method;
  }

  displayName(): string {
    return this.getIsBlock() ? 'block' : this.getMethod();
  }

  getDepth(): number {
    return this.row.depth;
  }

  public set depth(depth: number) {
    this.row.depth = depth;
  }

  getId(): string | undefined {
    return this.row.id;
  }

  getFile(): string {
    return this.row.file;
  }

  public set file(file: string) {
    this.row.file = file;
  }

  getLine(): string {
    return this.row.line;
  }

  getIsGemEntry(): boolean {
    return this.row.gemEntry === 1;
  }

  getIsDepthTruncated(): boolean {
    return this.row.isDepthTruncated === 1;
  }

  setDepthTruncated(truncated: boolean): void {
    this.row.isDepthTruncated = truncated ? 1 : 0;
  }

  getLinesExecuted(): number[] {
    return [];
  }

  getLineRanges(): lineRange[] {
    const line = parseInt(this.getLine());
    if (isNaN(line)) {
      return [];
    }
    return [{ line: line }];
  }

  getAllLines(): number[] {
    return this.getLineRanges().map((range) => {
      return range.line;
    });
  }

  getMethodStartLine(): number | null {
    return null;
  }

  getMethodEndLine(): number | null {
    return null;
  }

  getParentId(): string | null {
    return this.row.parent_id;
  }

  private _generateSourceName(): void {
    if (this.sourceName === null) {
      const source = NodeSourceAR.getByUri(vscode.Uri.file(this.getFile()));
      if (source) {
        this.sourceName = source.name;
      } else {
        this.sourceName = 'other';
      }
    }
  }

  getSourceName(): string {
    return this.sourceName as string;
  }

  getIsBlock(): boolean {
    return this.row.block === 1;
  }

  getCaller(): string {
    return this.row.caller;
  }

  getCallerLine(): number {
    if (this._callerLine === null) {
      this._callerLine = parseInt(this.getCaller().split(':')[1]) - 1;
    }
    return this._callerLine;
  }

  getReturnVal(): string {
    return this.row.return_value;
  }

  getIsScript(): boolean {
    return this.row.script === 1;
  }

  getIsRoot(): boolean {
    return this.getParentId() === null;
  }

  static async findById(id: number): Promise<TreeNodeDataAR | null> {
    if (this._findByIdCache.has(id.toString())) {
      return this._findByIdCache.get(id.toString())!;
    } else {
      const query = `SELECT * FROM treenodes WHERE id = ?`;
      return TreeNodeDataAR._get(query, [id.toString()]);
    }
  }

  static findByFileAndLine(file: string, line: number): Promise<TreeNodeDataAR | null> {
    const query = `SELECT * FROM treenodes
      WHERE file = ?
      AND line = ?
      LIMIT 1`;
    return TreeNodeDataAR._get(query, [file, line.toString()]);
  }

  private static async _get(query: string, params: (string | number | boolean | null)[] = []): Promise<TreeNodeDataAR | null> {
    try {
      const row = await TreeNodeDataAR.executor().get<TreeNodeDataARInterface>(query, params);
      if (row) {
        return new TreeNodeDataAR(row);
      } 
      return null;
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching node from the database: ' + (err as Error).message);
      return null;
    }
  }

  private static async _query(query: string, params: (string | number | boolean | null)[] = []): Promise<Record<string, unknown> | null> {
    try {
      const row = await TreeNodeDataAR.executor().get<Record<string, unknown>>(query, params);
      return row || null;
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching query from the database: ' + (err as Error).message);
      return null;
    }
  }

  public async hasChildren(): Promise<boolean> {
    let query: string;
    let params: (string | number | boolean | null)[] = [];
    
    if (this.getId()) {
      query = `SELECT COUNT(*) as count FROM treenodes WHERE parent_id = ?`;
      params = [this.getId() as string];
    } else {
      query = `SELECT COUNT(*) as count FROM treenodes WHERE parent_id IS NULL`;
    }
    
    const result = await TreeNodeDataAR._query(query, params);
    return result !== null && (result.count as number) > 0;
  }

  static async findAllChildren(parentId: string | null): Promise<TreeNodeDataAR[]> {
    if (this._findAllChildrenCache.has(parentId)) {
      return this._findAllChildrenCache.get(parentId)!;
    }
    
    let query: string;
    let params: (string | number | boolean | null)[] = [];
    
    if (parentId) {
      query = `SELECT isDepthTruncated, gemEntry, block, file, id, depth, parent_id, method, line, caller, return_value, script FROM treenodes WHERE parent_id = ? ORDER BY id`;
      params = [parentId];
    } else {
      query = `SELECT isDepthTruncated, gemEntry, block, file, id, depth, parent_id, method, line, caller, return_value, script FROM treenodes WHERE parent_id IS NULL ORDER BY id`;
    }
    
    return this._each(query, params);
  }

  static findAllNodesByFile(file: string): Promise<TreeNodeDataAR[]> {
    const query = `SELECT * FROM treenodes WHERE file = ? ORDER BY id`;
    return this._each(query, [file]);
  }

  static findAllCallsFromFile(file: string): Promise<TreeNodeDataAR[]> {
    const query = `SELECT * FROM treenodes WHERE parent_id IN (SELECT id FROM treenodes WHERE file = ?)`;
    return this._each(query, [file]);
  }

  private static async _each(query: string, params: (string | number | boolean | null)[] = []): Promise<TreeNodeDataAR[]> {
    try {
      const rows = await TreeNodeDataAR.executor().all<TreeNodeDataARInterface>(query, params);
      return rows.map(row => new TreeNodeDataAR(row));
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching nodes from the database: ' + (err as Error).message);
      return [];
    }
  }

  public static async _all(query: string, params: (string | number | boolean | null)[] = []): Promise<Record<string, unknown>[]> {
    try {
      return await TreeNodeDataAR.executor().all<Record<string, unknown>>(query, params);
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching records from the database: ' + (err as Error).message);
      return [];
    }
  }

  public static async findAllLinesExecutedByFile(path: string): Promise<number[]> {
    const nodes = await this.findAllNodesByFile(path);
    const lines = new Set<number>();
    nodes.forEach((node) => {
      node.getAllLines().forEach((line) => {
        lines.add(line);
      });
    });
    return Array.from(lines);
  }

  public static async findAllMethodCountByClass(condition: string): Promise<{ file: string, className: string }[]> {
    const query = `SELECT file, tp_class_name as className FROM treenodes WHERE ${condition} AND (block = 0 OR (block = 1 AND (method IS NULL OR method = ''))) GROUP BY className, file ORDER BY className, file`;
    const results = await this._all(query);
    return results.map(row => ({
      file: row.file as string,
      className: row.className as string
    }));
  }

  public static async findAllMethodCountByFile(condition: string): Promise<{ file: string, methodCount: number }[]> {
    const query = `SELECT file, count(*) as methodCount
                   FROM treenodes
                   WHERE ${condition}
                     AND (block = 0 OR (block = 1
                     AND (method IS NULL OR method = '')))
                   GROUP BY file ORDER BY file`;
    const rows = await this._all(query);
    return rows.map((row) => {
      return {
        file: row.file as string,
        methodCount: row.methodCount as number
      };
    });
  }

  public static async findAllFiles(): Promise<string[]> {
    const query = `SELECT DISTINCT file FROM treenodes ORDER BY file`;
    const rows = await this._all(query);
    return rows.map((row) => row.file as string);
  }
}
