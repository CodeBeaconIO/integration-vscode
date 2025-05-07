import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'child_process';
import { SQLiteConnection } from '../../state/db/sqliteConnection';
import { NodeSourceAR } from '../../state/activeRecord/nodeSourceAR';
import { TreeNodeDataAR } from '../../state/activeRecord/treeNodeDataAR';
import { MetaDataAR } from '../../state/activeRecord/metaDataAR';
import * as configModule from '../../config';

/**
 * Helper function to find SQLite binary path in the system
 */
export function findSqliteBinary(): { available: boolean; path?: string } {
  try {
    // Try to find sqlite3 with 'which' (Unix) or 'where' (Windows)
    const whichCommand = os.platform() === 'win32' ? 'where' : 'which';
    const { stdout } = cp.spawnSync(whichCommand, ['sqlite3'], { encoding: 'utf8' });
    const binaryPath = stdout.trim().split('\n')[0]; // Get the first result
    
    if (binaryPath && fs.existsSync(binaryPath)) {
      return { available: true, path: binaryPath };
    }
  } catch (err) {
    // If the command fails, sqlite3 might not be in PATH
  }
  
  // Check common locations
  const commonPaths = os.platform() === 'win32'
    ? ['C:\\Program Files\\SQLite\\sqlite3.exe', 'C:\\sqlite\\sqlite3.exe']
    : ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3', '/opt/homebrew/bin/sqlite3'];
  
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return { available: true, path: p };
    }
  }
  
  return { available: false };
}

/**
 * Helper function to reset the SQLiteConnection singleton
 */
export function resetSQLiteConnectionInstance(): void {
  // We need to access the instance property which is private
  // This is only for testing purposes
  const sqliteConnectionObj = SQLiteConnection as unknown as {
    instance: SQLiteConnection | undefined
  };
  sqliteConnectionObj.instance = undefined;
}

/**
 * Helper function to reset all ActiveRecord class executors by directly
 * nullifying their static executor references
 */
export function resetAllActiveRecordExecutors(): void {
  // Reset all ActiveRecord static executors by accessing their private static _executor property
  // This avoids calling reconnectDb which tries to reconnect to the default database
  const nodeSourceARClass = NodeSourceAR as unknown as { 
    _executor: unknown,
    _all: Map<string, NodeSourceAR>
  };
  const treeNodeDataARClass = TreeNodeDataAR as unknown as { 
    _executor: unknown,
    _findAllChildrenCache: Map<string | null, TreeNodeDataAR[]>,
    _findByIdCache: Map<string, TreeNodeDataAR>
  };
  const metaDataARClass = MetaDataAR as unknown as { 
    _executor: unknown,
    _all: Map<string, MetaDataAR>
  };
  
  // Reset the static executors
  nodeSourceARClass._executor = undefined;
  treeNodeDataARClass._executor = undefined;
  metaDataARClass._executor = undefined;
  
  // Clear caches
  if (nodeSourceARClass._all) {
    nodeSourceARClass._all.clear();
  }
  if (treeNodeDataARClass._findAllChildrenCache) {
    treeNodeDataARClass._findAllChildrenCache.clear();
  }
  if (treeNodeDataARClass._findByIdCache) {
    treeNodeDataARClass._findByIdCache.clear();
  }
  if (metaDataARClass._all) {
    metaDataARClass._all.clear();
  }
}

/**
 * Create a unique temp database path for testing
 */
export function createTempDb(): string {
  const tmpdir = os.tmpdir();
  const tempDbPath = path.join(tmpdir, `test-db-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
  fs.writeFileSync(tempDbPath, '');
  return tempDbPath;
}

/**
 * Override config for testing with a unique temp database
 * Returns the original createConfig function and the test database path
 */
export function overrideConfigForTesting(): { 
  originalCreateConfig: typeof configModule.createConfig; 
  testDbPath: string;
} {
  // Save original createConfig
  const originalCreateConfig = configModule.createConfig;
  
  // Create a temp DB file for testing
  const tmpdir = os.tmpdir();
  const testDbPath = path.join(tmpdir, `test-db-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
  
  // Touch the file so it exists
  fs.writeFileSync(testDbPath, '');
  
  // Find sqlite binary
  const sqliteCheck = findSqliteBinary();
  const binaryPath = sqliteCheck.available ? sqliteCheck.path : '';
  
  // Override createConfig
  Object.defineProperty(configModule, 'createConfig', {
    value: () => ({
      getSqliteBinaryPath: () => binaryPath,
      getDataDir: () => tmpdir,
      getDbDir: () => tmpdir,
      getDbPath: () => testDbPath,
      getRefreshPath: () => path.join(tmpdir, 'refresh'),
      getRootDir: () => tmpdir,
      getPathsPath: () => path.join(tmpdir, 'paths.yml')
    }),
    writable: true,
    configurable: true
  });
  
  return { originalCreateConfig, testDbPath };
}

/**
 * Restore original config after testing
 */
export function restoreOriginalConfig(originalCreateConfig: typeof configModule.createConfig): void {
  Object.defineProperty(configModule, 'createConfig', {
    value: originalCreateConfig,
    writable: true,
    configurable: true
  });
}

/**
 * Setup complete database isolation for tests
 * Resets all static executors and SQLiteConnection singleton
 * Creates a unique test database and overrides config
 */
export function setupDatabaseIsolation(): {
  originalCreateConfig: typeof configModule.createConfig;
  testDbPath: string;
} {
  // Reset all static executors and singletons
  resetSQLiteConnectionInstance();
  resetAllActiveRecordExecutors();
  
  // Override config with unique test database
  return overrideConfigForTesting();
}

/**
 * Teardown database isolation after tests
 * Closes any open connections, resets all static references,
 * restores original config, and deletes test database
 */
export async function teardownDatabaseIsolation(
  originalCreateConfig: typeof configModule.createConfig,
  testDbPath: string
): Promise<void> {
  // Try to close any open connections
  try {
    const executor = SQLiteConnection.getExecutor();
    await executor.close();
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Reset all static executors and singletons
  resetSQLiteConnectionInstance();
  resetAllActiveRecordExecutors();
  
  // Restore original config
  restoreOriginalConfig(originalCreateConfig);
  
  // Delete test database
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (err) {
      console.error('Error deleting test database:', err);
    }
  }
} 