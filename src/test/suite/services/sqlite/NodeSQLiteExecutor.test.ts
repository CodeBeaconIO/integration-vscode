import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SqliteBinaryNotConfiguredError } from '../../../../services/sqlite/SQLiteExecutor';
import { NodeSQLiteExecutor } from '../../../../services/sqlite/NodeSQLiteExecutor';
import { SQLiteExecutorFactory } from '../../../../services/sqlite/SQLiteExecutorFactory';
import * as configModule from '../../../../config';
import { IConfig } from '../../../../config';

// Mock for the config
const originalCreateConfig = configModule.createConfig;

suite('NodeSQLiteExecutor', () => {
  let testDbPath: string;
  let executor: NodeSQLiteExecutor;

  setup(() => {
    // Replace the createConfig function with a mock version
    (configModule as { createConfig: () => IConfig }).createConfig = () => ({
      getSqliteBinaryPath: () => '',
      getDataDir: () => '',
      getDbDir: () => '',
      getDbPath: () => '',
      getRefreshPath: () => '',
      getRootDir: () => '',
      getPathsPath: () => ''
    });
  });

  teardown(() => {
    // Restore the original function
    (configModule as { createConfig: () => IConfig }).createConfig = originalCreateConfig;
  });

  suiteSetup(async () => {
    // Create a temporary test database
    const tmpdir = os.tmpdir();
    testDbPath = path.join(tmpdir, `test-db-${Date.now()}.sqlite`);
    
    // Initialize the database with a test table
    executor = new NodeSQLiteExecutor(`:memory:`); // Use in-memory DB for tests
    
    await executor.exec(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER
      );
      
      INSERT INTO test_table (name, value) VALUES ('test1', 100);
      INSERT INTO test_table (name, value) VALUES ('test2', 200);
      INSERT INTO test_table (name, value) VALUES ('test3', 300);
    `);
  });

  suiteTeardown(async () => {
    // Close the database connection
    await executor.close();
    
    // Remove the test database file if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  suite('get()', () => {
    test('should return a single row', async () => {
      const row = await executor.get<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['test1']
      );
      
      assert.strictEqual(row?.name, 'test1');
      assert.strictEqual(row?.value, 100);
    });
    
    test('should return undefined when no rows match', async () => {
      const row = await executor.get<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['nonexistent']
      );
      
      assert.strictEqual(row, undefined);
    });
    
    test('should reject on invalid SQL', async () => {
      let error: Error | undefined;
      try {
        await executor.get<{ id: number, name: string, value: number }>(
          'SELECT * FROM nonexistent_table'
        );
      } catch (err) {
        error = err as Error;
      }
      assert.ok(error, 'Expected an error to be thrown');
    });
  });
  
  suite('all()', () => {
    test('should return all matching rows', async () => {
      const rows = await executor.all<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table ORDER BY id'
      );
      
      assert.strictEqual(rows.length, 3);
      assert.strictEqual(rows[0].name, 'test1');
      assert.strictEqual(rows[1].name, 'test2');
      assert.strictEqual(rows[2].name, 'test3');
    });
    
    test('should return empty array when no rows match', async () => {
      const rows = await executor.all<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['nonexistent']
      );
      
      assert.strictEqual(rows.length, 0);
    });
  });
  
  suite('run()', () => {
    test('should execute statements and return last ID and changes', async () => {
      const result = await executor.run(
        'INSERT INTO test_table (name, value) VALUES (?, ?)',
        ['test4', 400]
      );
      
      assert.ok(result.lastID > 0);
      assert.strictEqual(result.changes, 1);
      
      // Verify the row was inserted
      const row = await executor.get<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['test4']
      );
      
      assert.strictEqual(row?.name, 'test4');
      assert.strictEqual(row?.value, 400);
    });
  });
  
  suite('transactions', () => {
    test('should support transactions with commit', async () => {
      await executor.beginTransaction();
      await executor.run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['tx1', 1000]);
      await executor.commit();
      
      // Verify the row was inserted
      const row = await executor.get<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['tx1']
      );
      
      assert.strictEqual(row?.name, 'tx1');
    });
    
    test('should support transactions with rollback', async () => {
      await executor.beginTransaction();
      await executor.run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['tx2', 2000]);
      await executor.rollback();
      
      // Verify the row was NOT inserted
      const row = await executor.get<{ id: number, name: string, value: number }>(
        'SELECT * FROM test_table WHERE name = ?',
        ['tx2']
      );
      
      assert.strictEqual(row, undefined);
    });
  });
  
  suite('SQLiteExecutorFactory', () => {
    test('should create a NodeSQLiteExecutor from factory', () => {
      const testExecutor = SQLiteExecutorFactory.createNodeExecutor(':memory:');
      assert.ok(testExecutor instanceof NodeSQLiteExecutor);
    });
    
    test('should throw SqliteBinaryNotConfiguredError when binary required but not configured', () => {
      let error: Error | undefined;
      try {
        SQLiteExecutorFactory.createExecutor(':memory:', true);
      } catch (err) {
        error = err as Error;
      }
      assert.ok(error instanceof SqliteBinaryNotConfiguredError);
    });
  });
}); 