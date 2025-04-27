import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import sqlite3 from 'sqlite3';
import SQLite3Connection, { MissingDbError } from '../../../../state/db/sqlite3Connection';
import * as configModule from '../../../../config';

suite('SQLite3Connection', () => {
  // Define paths for our test databases
  let testDir: string;
  let showErrorMessages: string[] = [];
  let originalCreateConfig: typeof configModule.createConfig;
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;
  
  // Helper to initialize a test database
  async function initTestDb(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      db.exec(`
        CREATE TABLE IF NOT EXISTS treenodes (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
        INSERT INTO treenodes (name) VALUES ('test1');
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          db.close(() => resolve());
        }
      });
    });
  }
  
  // Helper to reset the singleton instance for testing
  function resetSQLite3ConnectionInstance(): void {
    // We need to access the instance property which is private
    // This is only for testing purposes
    const sqliteConnectionObj = SQLite3Connection as unknown as {
      instance: SQLite3Connection | undefined
    };
    sqliteConnectionObj.instance = undefined;
  }
  
  setup(() => {
    testDir = path.join(os.tmpdir(), `sqlite3-connection-test-${Date.now()}`);
    
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create db subdirectory
    const dbDir = path.join(testDir, 'db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Save original createConfig function
    originalCreateConfig = configModule.createConfig;
    
    // Override createConfig function
    Object.defineProperty(configModule, 'createConfig', {
      value: () => ({
        getDataDir: () => testDir,
        getDbDir: () => dbDir,
        getDbPath: () => path.join(dbDir, 'test.db'),
        getRefreshPath: () => path.join(testDir, 'refresh'),
        getRootDir: () => testDir,
        getPathsPath: () => path.join(testDir, 'paths.yml'),
        getSqliteBinaryPath: () => ''
      }),
      writable: true,
      configurable: true
    });
    
    // Initialize error message tracking
    showErrorMessages = [];
    originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = function(message: string): Thenable<string | undefined> {
      showErrorMessages.push(message);
      return Promise.resolve(undefined);
    };
    
    // Reset the singleton instance between tests
    resetSQLite3ConnectionInstance();
  });
  
  teardown(() => {
    // Restore original functions
    Object.defineProperty(configModule, 'createConfig', {
      value: originalCreateConfig,
      writable: true,
      configurable: true
    });
    vscode.window.showErrorMessage = originalShowErrorMessage;
    
    // Try to remove the test directory and all its contents
    try {
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(path.join(testDir, 'db'));
        files.forEach(file => {
          fs.unlinkSync(path.join(testDir, 'db', file));
        });
        fs.rmdirSync(path.join(testDir, 'db'));
        fs.rmdirSync(testDir);
      }
    } catch (err) {
      console.error('Error cleaning up test directory:', err);
    }
  });
  
  // We can directly test the MissingDbError by constructing it
  test('MissingDbError should be properly constructed', () => {
    const error = new MissingDbError('Test message');
    assert.strictEqual(error.name, 'MissingDbError');
    assert.strictEqual(error.message, 'Test message');
  });
  
  test('connect should create a new instance with the specified database file', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Connect to the database
    SQLite3Connection.connect('test.db');
    
    // Get the database
    const db = SQLite3Connection.getDatabase();
    
    // Verify we can query the database
    return new Promise<void>((resolve, reject) => {
      db.get('SELECT * FROM treenodes WHERE name = ?', ['test1'], (err, row: unknown) => {
        if (err) {
          reject(err);
        } else {
          // Type check and assertion
          if (row && typeof row === 'object' && 'name' in row) {
            assert.strictEqual((row as { name: string }).name, 'test1');
            resolve();
          } else {
            reject(new Error('Expected row with name property'));
          }
        }
      });
    });
  });
  
  test('reconnect should create a new instance with the same database path', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Connect to the database
    SQLite3Connection.connect('test.db');
    
    // Get the initial database
    const db1 = SQLite3Connection.getDatabase();
    
    // Reconnect
    SQLite3Connection.reconnect();
    
    // Get the database after reconnect
    const db2 = SQLite3Connection.getDatabase();
    
    // The database objects should be different (new connection)
    assert.notStrictEqual(db1, db2, 'reconnect should create a new database connection');
    
    // But they should both be sqlite3.Database instances
    assert.ok(db1 instanceof sqlite3.Database);
    assert.ok(db2 instanceof sqlite3.Database);
  });
  
  test('getInstance should create instance if it does not exist', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Get instance through getInstance
    const instance = SQLite3Connection.getInstance();
    
    // It should be a valid instance
    assert.ok(instance);
    
    // Get the database and check if it works
    const db = instance.getDatabase();
    assert.ok(db instanceof sqlite3.Database);
    
    // Get it again, should be same instance
    const instance2 = SQLite3Connection.getInstance();
    assert.strictEqual(instance, instance2, 'Should return the same instance');
  });
  
  test('getDatabase should return the database from the instance', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Connect to the database
    SQLite3Connection.connect('test.db');
    
    // Get the instance directly (need to cast to access private method)
    const instance = (SQLite3Connection as unknown as { 
      instance: SQLite3Connection 
    }).instance;
    
    // Get the database directly from the instance
    const db1 = instance.getDatabase();
    
    // Get the database via the static method
    const db2 = SQLite3Connection.getDatabase();
    
    // They should be the same object
    assert.strictEqual(db1, db2, 'Both methods should return the same database');
  });
}); 