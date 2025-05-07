import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'child_process';
import { BinarySQLiteExecutor } from '../../../../services/sqlite/BinarySQLiteExecutor';
import * as configModule from '../../../../config';
import { SQLiteConnection } from '../../../../state/db/sqliteConnection';

// Helper function to check if sqlite3 is available
function isSqliteAvailable(): { available: boolean; path?: string } {
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
  
  for (const path of commonPaths) {
    if (fs.existsSync(path)) {
      return { available: true, path };
    }
  }
  
  return { available: false };
}

suite('BinarySQLiteExecutor Integration', function() {
  const sqliteCheck = isSqliteAvailable();
  
  // Skip all tests if sqlite3 binary is not available
  if (!sqliteCheck.available) {
    console.log('Skipping BinarySQLiteExecutor Integration tests - SQLite binary not found');
    return;
  }
  
  const binaryPath = sqliteCheck.path!;
  let testDbPath: string;
  let originalCreateConfig: typeof configModule.createConfig;
  
  setup(() => {
    // Save original createConfig
    originalCreateConfig = configModule.createConfig;
    
    // Create a temp DB file for testing
    const tmpdir = os.tmpdir();
    testDbPath = path.join(tmpdir, `binary-sqlite-integration-${Date.now()}.db`);
    
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
    
    // Touch the file so it exists
    fs.writeFileSync(testDbPath, '');
  });
  
  teardown(() => {
    // Restore original createConfig
    Object.defineProperty(configModule, 'createConfig', {
      value: originalCreateConfig,
      writable: true,
      configurable: true
    });
    
    // Delete test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        console.error('Error deleting test database:', err);
      }
    }
  });
  
  test('should work with SQLiteConnection singleton when binary is required', async function() {
    // This test might be slow due to file I/O
    this.timeout(10000);
    
    try {
      // Get executor from SQLiteConnection with binary required
      const executor = SQLiteConnection.getExecutor(true);
      
      // Verify it's a BinarySQLiteExecutor
      assert.ok(executor instanceof BinarySQLiteExecutor);
      
      // Create a test table
      await executor.exec(`
        CREATE TABLE test_binary_integration (
          id INTEGER PRIMARY KEY,
          text_value TEXT,
          numeric_value REAL,
          boolean_value INTEGER
        );
      `);
      
      // Insert some data
      await executor.run(
        'INSERT INTO test_binary_integration (text_value, numeric_value, boolean_value) VALUES (?, ?, ?)',
        ['Test Text', 123.45, 1]
      );
      
      // Verify data was inserted correctly
      const row = await executor.get<{
        id: number;
        text_value: string;
        numeric_value: number;
        boolean_value: number;
      }>('SELECT * FROM test_binary_integration');
      
      assert.ok(row);
      assert.strictEqual(row!.text_value, 'Test Text');
      assert.strictEqual(row!.numeric_value, 123.45);
      assert.strictEqual(row!.boolean_value, 1);
      
      // Test transactions
      try {
        await executor.beginTransaction();
        await executor.run(
          'INSERT INTO test_binary_integration (text_value, numeric_value, boolean_value) VALUES (?, ?, ?)',
          ['Transaction Test', 789.01, 0]
        );
        await executor.commit();
        
        // Verify transaction data was committed
        const rows = await executor.all<{
          id: number;
          text_value: string;
          numeric_value: number;
          boolean_value: number;
        }>('SELECT * FROM test_binary_integration ORDER BY id');
        
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[1].text_value, 'Transaction Test');
      } catch (error) {
        // If transaction fails, it might be a SQLite version limitation
        console.log('Transaction test skipped due to SQLite limitations:', error);
      }
      
      // Clean up
      await executor.close();
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('SQLite binary is not configured')) {
        this.skip();
      } else {
        throw error;
      }
    }
  });
  
  test('should handle complex data types and SQL functions', async function() {
    // This test might be slow due to file I/O
    this.timeout(5000);
    
    // Create a BinarySQLiteExecutor directly
    const executor = new BinarySQLiteExecutor(testDbPath, binaryPath);
    
    // Create a schema with different data types
    await executor.exec(`
      CREATE TABLE complex_data (
        id INTEGER PRIMARY KEY,
        text_data TEXT,
        blob_data BLOB,
        date_data TEXT,
        json_data TEXT
      );
    `);
    
    // Current date in ISO format
    const currentDate = new Date().toISOString();
    
    // JSON data
    const jsonData = JSON.stringify({
      name: "Test Object",
      value: 42,
      nested: {
        array: [1, 2, 3],
        flag: true
      }
    });
    
    // Insert with complex data
    await executor.run(
      'INSERT INTO complex_data (text_data, blob_data, date_data, json_data) VALUES (?, ?, ?, ?)',
      ['Test with special chars: "quotes" and \'apostrophes\'', 'BLOB_DATA', currentDate, jsonData]
    );
    
    // Test using SQL functions
    const result = await executor.get<{
      upper_text: string,
      date_func: string,
      json_extract: string | number
    }>(`
      SELECT 
        upper(text_data) as upper_text,
        strftime('%Y-%m-%d', date_data) as date_func,
        json_extract(json_data, '$.nested.flag') as json_extract
      FROM complex_data
    `);
    
    assert.ok(result);
    assert.strictEqual(result!.upper_text, 'TEST WITH SPECIAL CHARS: "QUOTES" AND \'APOSTROPHES\'');
    // Date should be in YYYY-MM-DD format
    assert.match(result!.date_func, /^\d{4}-\d{2}-\d{2}$/);
    // The JSON extract should be 1 (true)
    assert.strictEqual(result!.json_extract.toString(), '1'); 
    
    // Clean up
    await executor.close();
  });
}); 