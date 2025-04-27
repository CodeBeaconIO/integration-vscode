import * as fs from 'fs';
import sqlite3 from 'sqlite3';
import { SQLiteExecutor, SQLiteExecutionError } from './SQLiteExecutor';

/**
 * Node.js implementation of SQLiteExecutor using the sqlite3 package
 */
export class NodeSQLiteExecutor implements SQLiteExecutor {
  private db: sqlite3.Database;
  private inTransaction: boolean = false;

  /**
   * Creates a new NodeSQLiteExecutor
   * @param dbPath Path to the SQLite database file or ":memory:" for in-memory database
   * @throws Error if the database file doesn't exist (except for in-memory database)
   */
  constructor(dbPath: string) {
    if (dbPath !== ':memory:' && !fs.existsSync(dbPath)) {
      throw new Error(`Database file does not exist: ${dbPath}`);
    }

    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * Get a single row from the database
   */
  get<T>(query: string, params: (string | number | boolean | null)[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err: Error | null, row: T) => {
        if (err) {
          reject(new SQLiteExecutionError(`Error executing query: ${query}`, err));
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Get all rows from the database
   */
  all<T>(query: string, params: (string | number | boolean | null)[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err: Error | null, rows: T[]) => {
        if (err) {
          reject(new SQLiteExecutionError(`Error executing query: ${query}`, err));
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * Run a statement in the database
   */
  run(query: string, params: (string | number | boolean | null)[] = []): Promise<{ lastID: number, changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(new SQLiteExecutionError(`Error executing query: ${query}`, err));
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Execute multiple SQL statements
   */
  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err: Error | null) => {
        if (err) {
          reject(new SQLiteExecutionError(`Error executing SQL: ${sql}`, err));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      return Promise.resolve();
    }
    
    return this.run('BEGIN TRANSACTION', [])
      .then(() => {
        this.inTransaction = true;
      });
  }

  /**
   * Commit a transaction
   */
  commit(): Promise<void> {
    if (!this.inTransaction) {
      return Promise.resolve();
    }
    
    return this.run('COMMIT', [])
      .then(() => {
        this.inTransaction = false;
      });
  }

  /**
   * Rollback a transaction
   */
  rollback(): Promise<void> {
    if (!this.inTransaction) {
      return Promise.resolve();
    }
    
    return this.run('ROLLBACK', [])
      .then(() => {
        this.inTransaction = false;
      });
  }

  /**
   * Close the database connection
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) {
          reject(new SQLiteExecutionError('Error closing database connection', err));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get the raw database object
   */
  getDatabase(): sqlite3.Database {
    return this.db;
  }
} 