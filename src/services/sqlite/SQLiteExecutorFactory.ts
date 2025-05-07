import { createConfig } from '../../config';
import { SQLiteExecutor, SqliteBinaryNotConfiguredError, SQLiteExecutionError } from './SQLiteExecutor';
import { NodeSQLiteExecutor } from './NodeSQLiteExecutor';
import { BinarySQLiteExecutor } from './BinarySQLiteExecutor';
import * as fs from 'fs';

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
   * Create a SQLite executor that uses the binary CLI
   * @param dbPath Path to the SQLite database file
   * @param binaryPath Path to the SQLite binary
   */
  static createBinaryExecutor(dbPath: string, binaryPath: string): SQLiteExecutor {
    return new BinarySQLiteExecutor(dbPath, binaryPath);
  }

  /**
   * Create the most appropriate SQLite executor based on configuration
   * The order of preference is:
   * 1. Binary executor with configured path (if exists and is executable)
   * 2. Node.js executor (fallback)
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
    
    // Use binary executor if a valid binary path is configured
    if (binaryPath && fs.existsSync(binaryPath)) {
      try {
        return new BinarySQLiteExecutor(dbPath, binaryPath);
      } catch (error) {
        console.warn(`Failed to create binary SQLite executor: ${error instanceof Error ? error.message : String(error)}`);
        // If binary executor creation fails, fall back to Node.js implementation
        // But if requireBinary is true, we should still throw an error
        if (requireBinary) {
          throw new SQLiteExecutionError(
            `Failed to initialize SQLite binary at ${binaryPath}`, 
            error instanceof Error ? error : undefined
          );
        }
      }
    } else if (requireBinary) {
      throw new SqliteBinaryNotConfiguredError(
        `SQLite binary path is not valid: ${binaryPath}. Please configure a valid path.`
      );
    }
    
    // Fall back to Node.js implementation
    return new NodeSQLiteExecutor(dbPath);
  }
} 