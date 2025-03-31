import * as vscode from 'vscode';
import sqlite3 from 'sqlite3';
import SQLite3Connection from '../db/sqlite3Connection';

interface NodeSourceARInterface {
  id: string,
  name: string,
  root_path: string
}

export class NodeSourceAR {
  private static _db: sqlite3.Database;
  private static _all: Map<string, NodeSourceAR> = new Map(); // These are inserted in a particular order (by id)
  private row: NodeSourceARInterface;
  
  constructor(
    row: NodeSourceARInterface
  ) {
    this.row = row;
  }

  private static db(): sqlite3.Database {
    if (NodeSourceAR._db) {
      return this._db;
    } else {
      this._db = SQLite3Connection.getDatabase();
      return this._db;
    }
  }

  public static reconnectDb(testDb?: sqlite3.Database): void {
    this._db = testDb || SQLite3Connection.getDatabase();
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

  static loadAll(): Promise<void> {
    return NodeSourceAR.all()
      .then((nodeSources: NodeSourceAR[]) => {
        nodeSources.forEach((nodeSource) => {
          NodeSourceAR._all.set(nodeSource.name, nodeSource);
        });
      });
  }

  static all(): Promise<NodeSourceAR[]> {
    const query = `SELECT * FROM node_sources`;
    return new Promise((resolve, reject) => {
      NodeSourceAR.db().all<NodeSourceARInterface>(query, (err: Error | null, rows: NodeSourceARInterface[]) => {
        if (err) {
          vscode.window.showErrorMessage('Error fetching node sources from the database: ' + err.message);
          reject(err);
        }
        const allNodes: NodeSourceAR[] = [];
        rows.forEach((row) => {
          allNodes.push(new NodeSourceAR(row));
        });
        resolve(allNodes);
      });
    });
  }

  static findById(id: number): Promise<NodeSourceAR | null> {
    const query = `SELECT * FROM node_sources WHERE id = '${id}'`;
    return NodeSourceAR._get(query);
  }

  static findByName(name: string): Promise<NodeSourceAR | null> {
    const query = `SELECT * FROM node_sources WHERE name = '${name}'`;
    return NodeSourceAR._get(query);
  }

  private static _get(query: string): Promise<NodeSourceAR | null> {
    return new Promise((resolve, reject) => {
      NodeSourceAR.db().get<NodeSourceARInterface>(query, (err: Error | null, row: NodeSourceARInterface) => {
        if (err) {
          vscode.window.showErrorMessage('Error fetching node from the database: ' + err.message);
          reject(err);
        }
        if (row) {
          resolve(new NodeSourceAR(row));
        } else {
          resolve(null);
        }
      });
    });
  }
}