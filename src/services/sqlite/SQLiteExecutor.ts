/**
 * Interface for SQLite operations, allowing for different implementations
 * (Node.js sqlite3 or binary execution)
 */
export interface SQLiteExecutor {
  /**
   * Execute a SQL query and get a single row result
   */
  get<T>(query: string, params?: (string | number | boolean | null)[]): Promise<T | undefined>;
  
  /**
   * Execute a SQL query and get all matching rows
   */
  all<T>(query: string, params?: (string | number | boolean | null)[]): Promise<T[]>;
  
  /**
   * Execute a SQL statement with no results
   */
  run(query: string, params?: (string | number | boolean | null)[]): Promise<{ lastID: number, changes: number }>;
  
  /**
   * Execute multiple SQL statements
   */
  exec(sql: string): Promise<void>;
  
  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;
  
  /**
   * Commit a transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback a transaction
   */
  rollback(): Promise<void>;
  
  /**
   * Close the database connection
   */
  close(): Promise<void>;
}

/**
 * Custom error for missing SQLite binary
 */
export class SqliteBinaryNotConfiguredError extends Error {
  constructor(message: string = 'SQLite binary path is not configured') {
    super(message);
    this.name = 'SqliteBinaryNotConfiguredError';
  }
}

/**
 * Custom error for SQLite execution failures
 */
export class SQLiteExecutionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'SQLiteExecutionError';
  }
} 