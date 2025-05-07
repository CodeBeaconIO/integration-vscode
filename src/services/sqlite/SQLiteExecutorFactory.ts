import { createConfig } from '../../config';
import { SQLiteExecutor, SqliteBinaryNotConfiguredError, SQLiteExecutionError } from './SQLiteExecutor';
import { BinarySQLiteExecutor } from './BinarySQLiteExecutor';
import * as fs from 'fs';

/**
 * Factory for creating SQLiteExecutor instances
 */
export class SQLiteExecutorFactory {
  /**
   * Create a SQLite executor that uses the binary CLI
   * @param dbPath Path to the SQLite database file
   * @param binaryPath Path to the SQLite binary
   */
  static createBinaryExecutor(dbPath: string, binaryPath: string): SQLiteExecutor {
    return new BinarySQLiteExecutor(dbPath, binaryPath);
  }

  /**
   * Create a SQLite executor based on configuration
   * This will create a BinarySQLiteExecutor using the configured SQLite binary path
   * 
   * @param dbPath Path to the SQLite database file
   */
  static createExecutor(dbPath: string): SQLiteExecutor {
    const config = createConfig();
    const binaryPath = config.getSqliteBinaryPath();
    
    if (!binaryPath) {
      throw new SqliteBinaryNotConfiguredError(
        'SQLite binary path is not configured. Please set the code-beacon.sqliteBinaryPath in your settings.'
      );
    }
    
    // Verify binary path exists
    if (!fs.existsSync(binaryPath)) {
      throw new SqliteBinaryNotConfiguredError(
        `SQLite binary path is not valid: ${binaryPath}. Please configure a valid path.`
      );
    }
    
    try {
      return new BinarySQLiteExecutor(dbPath, binaryPath);
    } catch (error) {
      throw new SQLiteExecutionError(
        `Failed to initialize SQLite binary at ${binaryPath}`, 
        error instanceof Error ? error : undefined
      );
    }
  }
} 