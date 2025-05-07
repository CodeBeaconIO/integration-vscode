import * as fs from 'fs';
import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { SQLiteExecutor, SQLiteExecutionError } from './SQLiteExecutor';

/**
 * Implementation of SQLiteExecutor using a SQLite binary
 */
export class BinarySQLiteExecutor implements SQLiteExecutor {
  private dbPath: string;
  private binaryPath: string;
  private inTransaction: boolean = false;
  private tempDb: sqlite3.Database | null = null;
  private tempDbPath: string | null = null;

  /**
   * Creates a new BinarySQLiteExecutor
   * @param dbPath Path to the SQLite database file or ":memory:" for in-memory database
   * @param binaryPath Path to the SQLite binary
   * @throws Error if the database file doesn't exist (except for in-memory database)
   */
  constructor(dbPath: string, binaryPath: string) {
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`SQLite binary does not exist: ${binaryPath}`);
    }

    this.binaryPath = binaryPath;

    // For in-memory database, we need to create a temporary real file
    // SQLite binary can't directly use :memory:
    if (dbPath === ':memory:') {
      const tmpdir = os.tmpdir();
      this.tempDbPath = path.join(tmpdir, `temp-sqlite-${Date.now()}.db`);
      this.dbPath = this.tempDbPath;
      
      // Create the database file
      this.tempDb = new sqlite3.Database(this.tempDbPath);
    } else {
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist: ${dbPath}`);
      }
      this.dbPath = dbPath;
    }
  }

  /**
   * Execute a command using the SQLite binary
   */
  private async executeSqliteCommand(sql: string, params: (string | number | boolean | null)[] = []): Promise<string> {
    // Replace parameters in SQL for command line execution
    let processedSql = sql;
    if (params.length > 0) {
      // When using params, we need to make a new copy of the SQL query
      // to avoid modifying the original one for future calls
      processedSql = sql.slice();
      
      params.forEach((param) => {
        let stringValue: string;
        if (param === null) {
          stringValue = 'NULL';
        } else if (typeof param === 'string') {
          // Escape quotes in strings
          stringValue = `'${param.replace(/'/g, "''")}'`;
        } else if (typeof param === 'boolean') {
          stringValue = param ? '1' : '0';
        } else {
          stringValue = param.toString();
        }
        
        // Replace the first question mark
        const paramIndex = processedSql.indexOf('?');
        if (paramIndex !== -1) {
          processedSql = processedSql.substring(0, paramIndex) + stringValue + 
                         processedSql.substring(paramIndex + 1);
        }
      });
    }

    // Write SQL to a temp file for execution
    // This is more reliable than passing via stdin, especially for large queries
    const tmpdir = os.tmpdir();
    const sqlFilePath = path.join(tmpdir, `sqlite-query-${Date.now()}.sql`);
    fs.writeFileSync(sqlFilePath, processedSql);

    try {
      // Prepare command for execution with the SQL file
      const command = `"${this.binaryPath}" -json "${this.dbPath}" < "${sqlFilePath}"`;
      
      const { stdout, stderr } = await this.execPromise(command);
      
      if (stderr && stderr.trim()) {
        throw new Error(stderr.trim());
      }
      
      return stdout;
    } finally {
      // Clean up the temporary SQL file
      if (fs.existsSync(sqlFilePath)) {
        fs.unlinkSync(sqlFilePath);
      }
    }
  }

  /**
   * Execute a shell command
   */
  private execPromise(command: string): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolve, reject) => {
      cp.exec(command, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error && error.code !== 0) {
          reject(new Error(`Command failed with exit code ${error.code}: ${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Get a single row from the database
   */
  async get<T>(query: string, params: (string | number | boolean | null)[] = []): Promise<T | undefined> {
    try {
      const result = await this.executeSqliteCommand(query, params);
      if (!result || !result.trim()) {
        return undefined;
      }
      
      try {
        const rows = JSON.parse(result);
        return Array.isArray(rows) && rows.length > 0 ? rows[0] as T : undefined;
      } catch (jsonError) {
        // If we can't parse the result as JSON, return undefined
        return undefined;
      }
    } catch (error) {
      throw new SQLiteExecutionError(`Error executing query: ${query}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get all rows from the database
   */
  async all<T>(query: string, params: (string | number | boolean | null)[] = []): Promise<T[]> {
    try {
      const result = await this.executeSqliteCommand(query, params);
      if (!result || !result.trim()) {
        return [];
      }
      
      try {
        const rows = JSON.parse(result);
        return Array.isArray(rows) ? rows as T[] : [];
      } catch (jsonError) {
        // If we can't parse the result as JSON, return empty array
        return [];
      }
    } catch (error) {
      throw new SQLiteExecutionError(`Error executing query: ${query}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Run a statement in the database
   */
  async run(query: string, params: (string | number | boolean | null)[] = []): Promise<{ lastID: number, changes: number }> {
    try {
      // Execute statement
      await this.executeSqliteCommand(query, params);
      
      // Get last ID and changes
      const lastRowId = await this.executeSqliteCommand('SELECT last_insert_rowid() as lastID');
      const changes = await this.executeSqliteCommand('SELECT changes() as changes');
      
      let lastID = 0;
      let changesCount = 0;
      
      try {
        const lastIDObj = JSON.parse(lastRowId);
        const changesObj = JSON.parse(changes);
        
        if (Array.isArray(lastIDObj) && lastIDObj.length > 0) {
          lastID = parseInt(lastIDObj[0].lastID || '0', 10);
        }
        
        if (Array.isArray(changesObj) && changesObj.length > 0) {
          changesCount = parseInt(changesObj[0].changes || '0', 10);
        }
      } catch (jsonError) {
        // Use default values if parsing fails
        console.error('Error parsing JSON result:', jsonError);
      }
      
      return {
        lastID,
        changes: changesCount
      };
    } catch (error) {
      throw new SQLiteExecutionError(`Error executing query: ${query}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Execute multiple SQL statements
   */
  async exec(sql: string): Promise<void> {
    try {
      await this.executeSqliteCommand(sql);
    } catch (error) {
      throw new SQLiteExecutionError(`Error executing SQL: ${sql}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      return;
    }
    
    try {
      await this.executeSqliteCommand('BEGIN TRANSACTION');
      this.inTransaction = true;
    } catch (error) {
      // Some versions of SQLite don't properly report transaction status
      // If the error indicates a transaction is already active, set the flag anyway
      if (error instanceof Error && error.message.includes('transaction is active')) {
        this.inTransaction = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    if (!this.inTransaction) {
      return;
    }
    
    try {
      await this.executeSqliteCommand('COMMIT');
      this.inTransaction = false;
    } catch (error) {
      // If the error indicates no transaction is active, clear the flag
      if (error instanceof Error && error.message.includes('no transaction is active')) {
        this.inTransaction = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      return;
    }
    
    try {
      await this.executeSqliteCommand('ROLLBACK');
      this.inTransaction = false;
    } catch (error) {
      // If the error indicates no transaction is active, clear the flag
      if (error instanceof Error && error.message.includes('no transaction is active')) {
        this.inTransaction = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    // If we have a temporary database, close it and delete the file
    if (this.tempDb) {
      return new Promise((resolve, reject) => {
        this.tempDb!.close((err: Error | null) => {
          if (err) {
            reject(new SQLiteExecutionError('Error closing database connection', err));
            return;
          }
          
          this.tempDb = null;
          
          // Delete the temporary database file
          if (this.tempDbPath && fs.existsSync(this.tempDbPath)) {
            try {
              fs.unlinkSync(this.tempDbPath);
              this.tempDbPath = null;
            } catch (unlinkErr) {
              console.error('Error deleting temporary database file:', unlinkErr);
            }
          }
          
          resolve();
        });
      });
    }
    
    return Promise.resolve();
  }

  /**
   * Get the raw database object
   * This is mainly for compatibility with the Node.js implementation
   * and may not be useful for the binary implementation
   */
  getDatabase(): sqlite3.Database {
    if (this.tempDb) {
      return this.tempDb;
    }
    
    // Create a temporary connection to return
    // This is not ideal, but maintains interface compatibility
    return new sqlite3.Database(this.dbPath);
  }
} 