import * as fs from 'fs';
import * as vscode from 'vscode';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { Config } from '../../config';

class MissingDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingDbError";
  }
}

class SQLite3Connection {
  private dbPath: string;
  private static instance: SQLite3Connection;
  private db: sqlite3.Database;

  private constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      throw new MissingDbError(`Database file does not exist: ${dbPath}`);
    }

    this.dbPath = dbPath;
    this.db = new sqlite3.Database(this.dbPath);
    this.checkTableExists();
  }
  
  public static getInstance(): SQLite3Connection {
    if (!SQLite3Connection.instance) {
      SQLite3Connection.instance = new SQLite3Connection(Config.dbPath);
    }
    return SQLite3Connection.instance;
  }

  public static connect(dbFileName: string): void {
    const dbPath = path.resolve(Config.dbDir, dbFileName);
    SQLite3Connection.instance = new SQLite3Connection(dbPath);
  }

  public static reconnect(): void {
    SQLite3Connection.instance = new SQLite3Connection(SQLite3Connection.instance.dbPath);
  }

  public static getDatabase(): sqlite3.Database {
    return SQLite3Connection.getInstance().getDatabase();
  }

  public getDatabase(): sqlite3.Database {
    return this.db;
  }

  private checkTableExists(): boolean {
    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='treenodes'";
    let tableExists = false;

    this.db.get(query, (err: Error | null, row: { name: string } | undefined) => {
      if (err) {
        vscode.window.showErrorMessage('Error checking table existence: ' + err.message);
        return;
      }

      if (row) {
        tableExists = true;
      }
    });

    return tableExists;
  }
}

export default SQLite3Connection;
export { MissingDbError };