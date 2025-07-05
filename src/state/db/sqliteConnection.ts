import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { createConfig } from '../../config';
import { SQLiteExecutor, SqliteBinaryNotConfiguredError } from '../../services/sqlite/SQLiteExecutor';
import { SQLiteExecutorFactory } from '../../services/sqlite/SQLiteExecutorFactory';

/**
 * Error thrown when a database file is missing
 */
export class MissingDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingDbError";
  }
}

/**
 * SQLiteConnection class that uses the SQLiteExecutor interface
 * This provides an abstraction layer allowing for SQLite operations
 * using the system's SQLite binary executable
 */
export class SQLiteConnection {
  private dbPath: string;
  private static instance: SQLiteConnection | undefined;
  private executor: SQLiteExecutor;

  /**
   * Create a SQLiteConnection instance
   * @param dbPath Path to the SQLite database file
   */
  private constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      throw new MissingDbError(`Database file does not exist: ${dbPath}`);
    }

    this.dbPath = dbPath;
    
    // Use the factory to get the appropriate executor
    try {
      this.executor = SQLiteExecutorFactory.createExecutor(this.dbPath);
    } catch (error) {
      if (error instanceof SqliteBinaryNotConfiguredError) {
        vscode.window.showErrorMessage('SQLite binary is not configured: ' + error.message);
      }
      throw error;
    }
    
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
    if (SQLiteConnection.instance) {
      SQLiteConnection.instance = new SQLiteConnection(SQLiteConnection.instance.dbPath);
    }
  }

  /**
   * Disconnect and clear the current instance
   */
  public static disconnect(): void {
    if (SQLiteConnection.instance) {
      SQLiteConnection.instance.executor.close();
      SQLiteConnection.instance = undefined;
    }
  }

  /**
   * Clear the current instance without closing executor (for cases where file is already deleted)
   */
  public static clearInstance(): void {
    SQLiteConnection.instance = undefined;
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
   * Check if the required table exists in the database
   */
  private async checkTableExists(): Promise<boolean> {
    try {
      const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='treenodes'";
      const row = await this.executor.get<{ name: string }>(query);
      return !!row;
    } catch (error) {
      console.error("Error checking table existence:", error);
      return false;
    }
  }
}