import * as vscode from 'vscode';
import { SQLiteConnection } from '../db/sqliteConnection';
import { SQLiteExecutor } from '../../services/sqlite/SQLiteExecutor';

interface NodeSourceARInterface {
  id: string,
  name: string,
  root_path: string
}

export class NodeSourceAR {
  private static _executor: SQLiteExecutor;
  private static _all: Map<string, NodeSourceAR> = new Map(); // These are inserted in a particular order (by id)
  private row: NodeSourceARInterface;
  
  constructor(
    row: NodeSourceARInterface
  ) {
    this.row = row;
  }

  private static executor(): SQLiteExecutor {
    if (NodeSourceAR._executor) {
      return this._executor;
    } else {
      this._executor = SQLiteConnection.getExecutor();
      return this._executor;
    }
  }

  public static reconnectDb(testExecutor?: SQLiteExecutor): void {
    NodeSourceAR._all.clear();
    this._executor = testExecutor || SQLiteConnection.getExecutor();
  }

  public get id(): string {
    return this.row.id;
  }
  
  public get name(): string {
    return this.row.name;
  }

  public get rootPath(): string {
    return this.row.root_path;
  }

  public static getByUri(uri: vscode.Uri): NodeSourceAR | null {
    for (const value of NodeSourceAR._all.values()) {
      if (uri.fsPath.startsWith(value.rootPath)) {
        return value;
      }
    }
    return null;
  }

  public static getByName(name: string): NodeSourceAR {
    const source = NodeSourceAR._all.get(name);
    if (source) {
      return source;
    } else {
      throw new Error(`Node source with name ${name} not found`);
    }
  }

  static async loadAll(): Promise<void> {
    const nodeSources = await NodeSourceAR.all();
    NodeSourceAR._all.clear();
    nodeSources.forEach((nodeSource) => {
      NodeSourceAR._all.set(nodeSource.name, nodeSource);
    });
  }

  static async all(): Promise<NodeSourceAR[]> {
    const query = `SELECT * FROM node_sources`;
    try {
      const rows = await NodeSourceAR.executor().all<NodeSourceARInterface>(query);
      return rows.map(row => new NodeSourceAR(row));
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching node sources from the database: ' + (err as Error).message);
      return [];
    }
  }

  static async findById(id: string | number): Promise<NodeSourceAR | null> {
    const query = `SELECT * FROM node_sources WHERE id = ?`;
    return NodeSourceAR._get(query, [id.toString()]);
  }

  static async findByName(name: string): Promise<NodeSourceAR | null> {
    const query = `SELECT * FROM node_sources WHERE name = ?`;
    return NodeSourceAR._get(query, [name]);
  }

  private static async _get(query: string, params: (string | number | boolean | null)[] = []): Promise<NodeSourceAR | null> {
    try {
      const row = await NodeSourceAR.executor().get<NodeSourceARInterface>(query, params);
      if (row) {
        return new NodeSourceAR(row);
      } else {
        return null;
      }
    } catch (err) {
      vscode.window.showErrorMessage('Error fetching node from the database: ' + (err as Error).message);
      return null;
    }
  }
}