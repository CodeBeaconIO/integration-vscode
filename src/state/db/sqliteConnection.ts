import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { createConfig } from '../../config';
import { SQLiteExecutor, SqliteBinaryNotConfiguredError } from '../../services/sqlite/SQLiteExecutor';
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
  private requireBinary: boolean;

  /**
   * Create a SQLiteConnection instance
   * @param dbPath Path to the SQLite database file
   * @param requireBinary If true, requires the SQLite binary to be configured
   */
  private constructor(dbPath: string, requireBinary: boolean = false) {
    if (!fs.existsSync(dbPath)) {
      throw new MissingDbError(`Database file does not exist: ${dbPath}`);
    }

    this.dbPath = dbPath;
    this.requireBinary = requireBinary;
    
    // Use the factory to get the appropriate executor
    try {
      this.executor = SQLiteExecutorFactory.createExecutor(this.dbPath, this.requireBinary);
    } catch (error) {
      if (error instanceof SqliteBinaryNotConfiguredError) {
        vscode.window.showErrorMessage('SQLite binary is required but not configured: ' + error.message);
      }
      throw error;
    }
    
    this.checkTableExists().catch(err => {
      vscode.window.showErrorMessage('Error checking table existence: ' + err.message);
    });
  }
  
  /**
   * Get the singleton instance of SQLiteConnection
   * @param requireBinary If true, requires the SQLite binary to be configured
   */
  public static getInstance(requireBinary: boolean = false): SQLiteConnection {
    if (!SQLiteConnection.instance || 
        (requireBinary && !SQLiteConnection.instance.requireBinary)) {
      const config = createConfig();
      SQLiteConnection.instance = new SQLiteConnection(config.getDbPath(), requireBinary);
    }
    return SQLiteConnection.instance;
  }

  /**
   * Connect to a specific database file
   * @param dbFileName The name of the database file
   * @param requireBinary If true, requires the SQLite binary to be configured
   */
  public static connect(dbFileName: string, requireBinary: boolean = false): void {
    const config = createConfig();
    const dbPath = path.resolve(config.getDbDir(), dbFileName);
    SQLiteConnection.instance = new SQLiteConnection(dbPath, requireBinary);
  }

  /**
   * Reconnect to the database (closes current connection and opens a new one)
   * @param requireBinary If true, requires the SQLite binary to be configured
   */
  public static reconnect(requireBinary?: boolean): void {
    // Use the current requireBinary setting if not explicitly provided
    const useBinary = requireBinary !== undefined 
      ? requireBinary 
      : SQLiteConnection.instance.requireBinary;
      
    SQLiteConnection.instance = new SQLiteConnection(SQLiteConnection.instance.dbPath, useBinary);
  }

  /**
   * Get the SQLite executor from the singleton instance
   * @param requireBinary If true, requires the SQLite binary to be configured
   */
  public static getExecutor(requireBinary: boolean = false): SQLiteExecutor {
    return SQLiteConnection.getInstance(requireBinary).getExecutor();
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