import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { createConfig } from '../../config';
import { SQLiteExecutor } from '../../services/sqlite/SQLiteExecutor';
import { SQLiteExecutorFactory } from '../../services/sqlite/SQLiteExecutorFactory';

class MissingDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingDbError";
  }
}

/**
 * SQLiteConnection class that uses the SQLiteExecutor interface
 * This provides a similar interface to SQLite3Connection but utilizes
 * the abstraction layer allowing for different SQLite implementations
 */
export class SQLiteConnection {
  private dbPath: string;
  private static instance: SQLiteConnection;
  private executor: SQLiteExecutor;

  private constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      throw new MissingDbError(`Database file does not exist: ${dbPath}`);
    }

    this.dbPath = dbPath;
    // Use the factory to get the appropriate executor
    this.executor = SQLiteExecutorFactory.createExecutor(this.dbPath);
    this.checkTableExists().catch(err => {
      vscode.window.showErrorMessage('Error checking table existence: ' + err.message);
    });
  }
  
  /**
   * Get the singleton instance of SQLiteConnection
   */
  public static getInstance(): SQLiteConnection {
    if (!SQLiteConnection.instance) {
      const config = createConfig();
      SQLiteConnection.instance = new SQLiteConnection(config.getDbPath());
    }
    return SQLiteConnection.instance;
  }

  /**
   * Connect to a specific database file
   * @param dbFileName The name of the database file
   */
  public static connect(dbFileName: string): void {
    const config = createConfig();
    const dbPath = path.resolve(config.getDbDir(), dbFileName);
    SQLiteConnection.instance = new SQLiteConnection(dbPath);
  }

  /**
   * Reconnect to the database (closes current connection and opens a new one)
   */
  public static reconnect(): void {
    SQLiteConnection.instance = new SQLiteConnection(SQLiteConnection.instance.dbPath);
  }

  /**
   * Get the SQLite executor from the singleton instance
   */
  public static getExecutor(): SQLiteExecutor {
    return SQLiteConnection.getInstance().getExecutor();
  }

  /**
   * Get the SQLite executor from this instance
   */
  public getExecutor(): SQLiteExecutor {
    return this.executor;
  }

  /**
   * Check if the required tables exist in the database
   */
  private async checkTableExists(): Promise<boolean> {
    try {
      const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='treenodes'";
      const row = await this.executor.get<{ name: string }>(query);
      return !!row;
    } catch (err) {
      vscode.window.showErrorMessage('Error checking table existence: ' + (err as Error).message);
      return false;
    }
  }
}

export { MissingDbError }; 