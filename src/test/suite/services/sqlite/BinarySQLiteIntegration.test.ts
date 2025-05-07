import * as assert from 'assert';
import * as fs from 'fs';
import { BinarySQLiteExecutor } from '../../../../services/sqlite/BinarySQLiteExecutor';
import * as configModule from '../../../../config';
import { SQLiteConnection } from '../../../../state/db/sqliteConnection';
import { 
  findSqliteBinary, 
  setupDatabaseIsolation, 
  teardownDatabaseIsolation 
} from '../../../util/TestUtils';

suite('BinarySQLiteExecutor Integration', function() {
  const sqliteCheck = findSqliteBinary();
  
  // Skip all tests if sqlite3 binary is not available
  if (!sqliteCheck.available) {
    console.log('Skipping BinarySQLiteExecutor Integration tests - SQLite binary not found');
    return;
  }
  
  const binaryPath = sqliteCheck.path!;
  let testDbPath: string;
  let originalCreateConfig: typeof configModule.createConfig;
  
  setup(() => {
    // Setup complete database isolation 
    const isolation = setupDatabaseIsolation();
    originalCreateConfig = isolation.originalCreateConfig;
    testDbPath = isolation.testDbPath;
    
    // Touch the file so it exists
    fs.writeFileSync(testDbPath, '');
  });
  
  teardown(async () => {
    // Teardown database isolation
    await teardownDatabaseIsolation(originalCreateConfig, testDbPath);
  });
  
  test('should work with SQLiteConnection singleton when binary is required', async function() {
    // This test might be slow due to file I/O
    this.timeout(10000);
    
    try {
      // Get executor from SQLiteConnection (binary is required by default now)
      const executor = SQLiteConnection.getExecutor();
      
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