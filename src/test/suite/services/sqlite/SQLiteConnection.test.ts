import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { SQLiteConnection, MissingDbError } from '../../../../state/db/sqliteConnection';
import * as configModule from '../../../../config';
import { BinarySQLiteExecutor } from '../../../../services/sqlite/BinarySQLiteExecutor';

suite('SQLiteConnection', () => {
  // Define paths for our test databases
  let testDir: string;
  let showErrorMessages: string[] = [];
  let originalCreateConfig: typeof configModule.createConfig;
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;
  let testBinaryPath = '/usr/bin/sqlite3'; // Default path
  
  // Find a SQLite binary for tests
  function findSqliteBinary(): string {
    const platform = os.platform();
    const possiblePaths = platform === 'win32'
      ? ['C:\\Program Files\\SQLite\\sqlite3.exe', 'C:\\sqlite\\sqlite3.exe']
      : ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3', '/opt/homebrew/bin/sqlite3'];
      
    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    }
    
    return platform === 'win32' ? 'sqlite3.exe' : 'sqlite3';
  }
  
  // Helper to initialize a test database
  async function initTestDb(dbPath: string): Promise<void> {
    // Find a SQLite binary for tests
    const binaryPath = findSqliteBinary();
    
    // Create database file if it doesn't exist
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }
    
    const executor = new BinarySQLiteExecutor(dbPath, binaryPath);
    await executor.exec(`
      CREATE TABLE IF NOT EXISTS treenodes (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
      INSERT INTO treenodes (name) VALUES ('test1');
    `);
    await executor.close();
  }
  
  // Helper to reset the singleton instance for testing
  function resetSQLiteConnectionInstance(): void {
    // We need to access the instance property which is private
    // This is only for testing purposes
    const sqliteConnectionObj = SQLiteConnection as unknown as {
      instance: SQLiteConnection | undefined
    };
    sqliteConnectionObj.instance = undefined;
  }
  
  setup(() => {
    testDir = path.join(os.tmpdir(), `sqlite-connection-test-${Date.now()}`);
    testBinaryPath = findSqliteBinary();
    
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
        getDbDir: () => path.join(testDir, 'db'),
        getDbPath: () => path.join(testDir, 'db', 'test.db'),
        getRefreshPath: () => path.join(testDir, 'refresh'),
        getRootDir: () => testDir,
        getPathsPath: () => path.join(testDir, 'paths.yml'),
        getSqliteBinaryPath: () => testBinaryPath
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
    resetSQLiteConnectionInstance();
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
    SQLiteConnection.connect('test.db');
    
    // Get the executor
    const executor = SQLiteConnection.getExecutor();
    
    // Verify we can query the database
    const row = await executor.get<{ name: string }>('SELECT * FROM treenodes WHERE name = ?', ['test1']);
    assert.strictEqual(row?.name, 'test1');
  });
  
  test('reconnect should create a new instance with the same database path', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Connect to the database
    SQLiteConnection.connect('test.db');
    
    // Get the initial executor
    const executor1 = SQLiteConnection.getExecutor();
    
    // Reconnect
    SQLiteConnection.reconnect();
    
    // Get the executor after reconnect
    const executor2 = SQLiteConnection.getExecutor();
    
    // The executor objects should be different (new connection)
    assert.notStrictEqual(executor1, executor2, 'reconnect should create a new executor');
    
    // Both should have the SQLiteExecutor interface
    assert.ok('get' in executor1);
    assert.ok('all' in executor1);
    assert.ok('run' in executor1);
    assert.ok('exec' in executor1);
    
    assert.ok('get' in executor2);
    assert.ok('all' in executor2);
    assert.ok('run' in executor2);
    assert.ok('exec' in executor2);
  });
  
  test('getInstance should create instance if it does not exist', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Get instance through getInstance
    const instance = SQLiteConnection.getInstance();
    
    // It should be a valid instance
    assert.ok(instance);
    
    // Get the executor and check if it is valid
    const executor = instance.getExecutor();
    assert.ok('get' in executor);
    assert.ok('all' in executor);
    
    // Get it again, should be same instance
    const instance2 = SQLiteConnection.getInstance();
    assert.strictEqual(instance, instance2, 'Should return the same instance');
  });
  
  test('getExecutor should return the executor from the instance', async function() {
    // This test requires direct filesystem access and may be slow
    this.timeout(5000);
    
    // Create and initialize a test database
    const dbPath = path.join(testDir, 'db', 'test.db');
    fs.writeFileSync(dbPath, ''); // Create empty file
    await initTestDb(dbPath);
    
    // Connect to the database
    SQLiteConnection.connect('test.db');
    
    // Get the instance directly (need to cast to access private method)
    const instance = (SQLiteConnection as unknown as { 
      instance: SQLiteConnection 
    }).instance;
    
    // Get the executor directly from the instance
    const executor1 = instance.getExecutor();
    
    // Get the executor via the static method
    const executor2 = SQLiteConnection.getExecutor();
    
    // They should be the same object
    assert.strictEqual(executor1, executor2, 'Both methods should return the same executor');
  });
}); 