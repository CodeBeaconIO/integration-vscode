import * as vscode from 'vscode';
import sqlite3 from 'sqlite3';
import SQLite3Connection from '../db/sqlite3Connection';
import { lineRange } from '../../components/editor/editorUtils';
import { NodeSourceAR } from './nodeSourceAR';

interface TreeNodeDataARInterface {
  id: string | undefined,
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
  script: 0 | 1
}

export class TreeNodeDataAR {
  private static _db: sqlite3.Database;
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
    script: 0
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

  private static db(): sqlite3.Database {
    if (TreeNodeDataAR._db) {
      return this._db;
    } else {
      this._db = SQLite3Connection.getDatabase();
      return this._db;
    }
  }

  public static reconnectDb(): void {
    this._clearCache();
    this._db = SQLite3Connection.getDatabase();
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
      const query = `SELECT * FROM treenodes WHERE id = '${id}'`;
      return TreeNodeDataAR._get(query);
    }
  }

  static findByFileAndLine(file: string, line: number): Promise<TreeNodeDataAR | null> {
    const query = `SELECT * FROM treenodes
      WHERE file = '${file}'
      AND line = '${line}'
      LIMIT 1`;
    return TreeNodeDataAR._get(query);
  }

  private static _get(query: string): Promise<TreeNodeDataAR | null> {
    return new Promise((resolve) => {
      TreeNodeDataAR.db().get<TreeNodeDataARInterface>(query, (err: Error | null, row: TreeNodeDataARInterface) => {
        if (err) {
          vscode.window.showErrorMessage('Error fetching node from the database: ' + err.message);
          resolve(null);
        }
        if (row) {
          resolve(new TreeNodeDataAR(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  private static _query(query: string): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      TreeNodeDataAR.db().get<TreeNodeDataARInterface>(query, (err: Error | null, row: Record<string, unknown>) => {
        if (err) {
          vscode.window.showErrorMessage('Error fetching query from the database: ' + err.message);
          resolve(null);
        }
        resolve(row);
      });
    });
  }

  public hasChildren(): Promise<boolean> {
    let query: string;
    if (this.getId()) {
      query = `SELECT COUNT(*) as count FROM treenodes WHERE parent_id = '${this.getId()}'`;
    } else {
      query = `SELECT COUNT(*) as count FROM treenodes WHERE parent_id IS NULL`;
    }
    return TreeNodeDataAR._query(query).then((result) => {
      return result !== null && (result.count as number) > 0;
    });
  }

  static async findAllChildren(parentId: string | null): Promise<TreeNodeDataAR[]> {
    if (this._findAllChildrenCache.has(parentId)) {
      return this._findAllChildrenCache.get(parentId)!;
    } else {
      let query: string;
      if (parentId) {
        query = `SELECT isDepthTruncated, gemEntry, block, file, id, depth, parent_id, method, line, caller, return_value, script FROM treenodes WHERE parent_id = '${parentId}'`;
      } else {
        query = `SELECT isDepthTruncated, gemEntry, block, file, id, depth, parent_id, method, line, caller, return_value, script FROM treenodes WHERE parent_id IS NULL`;
      }
      return this._each(query);
    }
  }

  static findAllNodesByFile(file: string): Promise<TreeNodeDataAR[]> {
    const query = `SELECT * FROM treenodes WHERE file = '${file}'`;
    return this._each(query);
  }
  
  static findAllCallsFromFile(file: string): Promise<TreeNodeDataAR[]> {
    const query =
      `SELECT * FROM treenodes WHERE parent_id IN (SELECT id FROM treenodes WHERE file = '${file}')`;
    return this._each(query);
  }

  private static _each(query: string): Promise<TreeNodeDataAR[]> {
    return new Promise((resolve) => {
      const children: TreeNodeDataAR[] = [];

      TreeNodeDataAR.db().all<TreeNodeDataARInterface>(query,
        (err: Error | null, rows) => {
          if (err) {
            vscode.window.showErrorMessage('Error fetching app nodes from the database: ' + err.message);
            resolve([]);
          }
          rows.forEach((row) => {
            children.push(new TreeNodeDataAR(row));
          });

          resolve(children);
        }
      );
    });
  }

  // TODO put this in the parent class when we have one
  public static _all(query: string): Promise<Record<string, unknown>[]> {
    return new Promise((resolve) => {
      TreeNodeDataAR.db().all(query, 
          (err: Error | null, rows: Record<string, unknown>[]) => {
              if (err) {
                vscode.window.showErrorMessage('Error fetching nodes by file from the database: ' + err.message);
                resolve([]);
              }
              resolve(rows);
          }
      );
    });
  }

  public static async findAllLinesExecutedByFile(path: string): Promise<number[]> {
    const query = `
      SELECT DISTINCT line
      FROM treenodes
      WHERE file = '${path}'
    `;
    const rowsMethods = await this._all(query);
    const linesExecuted: number[] = rowsMethods.map((row) => parseInt(row.line as string, 10));
    return linesExecuted;
  }

  public static findAllMethodCountByClass(condition: string): Promise<{ file: string, className: string }[]> {
    const query = `SELECT file, tp_class_name as class_name FROM treenodes WHERE ${condition} AND (block = 0 OR (block = 1 AND (method IS NULL OR method = ''))) GROUP BY class_name, file ORDER BY class_name, file`;
    return new Promise((resolve) => {
      const classes: { file: string, className: string}[] = [];
      TreeNodeDataAR.db().all(query, (err: Error | null, rows: {file: string, class_name: string}[]) => {
          if (err) {
            vscode.window.showErrorMessage('Error fetching files from the database: ' + err.message);
            resolve([]);
          }
          rows.forEach((row) => {
            classes.push({file: row.file, className: row.class_name});
          });

          resolve(classes);
        }
      );
    });
  }

  public static findAllMethodCountByFile(condition: string): Promise<{ file: string, methodCount: number }[]> {
    const query = `SELECT file, block, method, count(*) as method_count
                   FROM treenodes
                   WHERE ${condition}
                     AND (block = 0 OR (block = 1
                     AND (method IS NULL OR method = '')))
                   GROUP BY file ORDER BY file`;
    return new Promise((resolve) => {
      const files: { file: string, methodCount: number }[] = [];
      TreeNodeDataAR.db().all(query, (err: Error | null, rows: {file: string, method_count: number}[]) => {
          if (err) {
            vscode.window.showErrorMessage('Error fetching files from the database: ' + err.message);
            resolve([]);
          }
          rows.forEach((row) => {
            files.push({file: row.file, methodCount: row.method_count});
          });

          resolve(files);
        }
      );
    });
  }

  public static findAllFiles(): Promise<string[]> {
    const query = `SELECT DISTINCT(file) FROM treenodes`;
    return new Promise((resolve) => {
      TreeNodeDataAR.db().all(query, (err: Error | null, rows: {file: string}[]) => {
          if (err) {
            vscode.window.showErrorMessage('Error fetching files from the database: ' + err.message);
            resolve([]);
          }
          resolve(rows.map((row) => row.file));
        }
      );
    });
  }
}
