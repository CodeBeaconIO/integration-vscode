import { createConfig } from '../../config';
import { SQLiteExecutor, SqliteBinaryNotConfiguredError } from './SQLiteExecutor';
import { NodeSQLiteExecutor } from './NodeSQLiteExecutor';

/**
 * Factory for creating SQLiteExecutor instances
 */
export class SQLiteExecutorFactory {
  /**
   * Create a Node.js SQLite executor
   * @param dbPath Path to the SQLite database file
   */
  static createNodeExecutor(dbPath: string): SQLiteExecutor {
    return new NodeSQLiteExecutor(dbPath);
  }

  /**
   * Create the most appropriate SQLite executor based on configuration
   * Currently only returns the Node.js implementation, but will be expanded
   * to support binary execution in the future.
   * 
   * @param dbPath Path to the SQLite database file
   * @param requireBinary If true, throws an error if SQLite binary is not configured
   */
  static createExecutor(dbPath: string, requireBinary: boolean = false): SQLiteExecutor {
    const config = createConfig();
    const binaryPath = config.getSqliteBinaryPath();
    
    if (requireBinary && !binaryPath) {
      throw new SqliteBinaryNotConfiguredError(
        'SQLite binary path is not configured. Please set the code-beacon.sqliteBinaryPath in your settings.'
      );
    }
    
    // For now, always return the Node.js implementation
    // In the future, this will check if binaryPath exists and return a BinarySQLiteExecutor
    return new NodeSQLiteExecutor(dbPath);
  }
} 