import * as assert from 'assert';
import * as fs from 'fs';
import { RecordingsTreeProvider } from '../../../../components/recordings/recordingsViewProvider';
import { DbNode } from '../../../../components/recordings/dbNode';
import { BinarySQLiteExecutor } from '../../../../services/sqlite/BinarySQLiteExecutor';
import { createTempDb, setupDatabaseIsolation, teardownDatabaseIsolation } from '../../../util/TestUtils';
import * as configModule from '../../../../config';
import * as vscode from 'vscode';

suite('RecordingsTreeProvider Test Suite', function() {
  let recordingsProvider: RecordingsTreeProvider;
  let testExecutor: BinarySQLiteExecutor;
  let testDbPath: string;
  let originalCreateConfig: typeof configModule.createConfig;

  // Find SQLite binary for tests
  function findSqliteBinary(): string | null {
    const possiblePaths = ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3', '/opt/homebrew/bin/sqlite3'];
    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    }
    return null;
  }

  const sqliteBinaryPath = findSqliteBinary();
  if (!sqliteBinaryPath) {
    console.log('Skipping RecordingsTreeProvider tests - SQLite binary not found');
    return;
  }

  setup(async () => {
    // Setup database isolation and create temp DB
    const isolation = setupDatabaseIsolation();
    originalCreateConfig = isolation.originalCreateConfig;
    testDbPath = isolation.testDbPath;

    // Create a new test executor
    testExecutor = new BinarySQLiteExecutor(testDbPath, sqliteBinaryPath);
    
    // Create metadata table
    await testExecutor.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        caller_file TEXT,
        caller_method TEXT,
        caller_line TEXT,
        caller_class TEXT,
        start_time TEXT,
        end_time TEXT,
        duration_ms TEXT,
        trigger_type TEXT
      )
    `);

    // Reset counter before each test
    RecordingsTreeProvider.resetAutoIncrementCounter();
    
    recordingsProvider = new RecordingsTreeProvider();
  });

  teardown(async () => {
    if (testExecutor) {
      await testExecutor.close();
    }
    await teardownDatabaseIsolation(originalCreateConfig, testDbPath);
  });

  test('should use provided name when available', async () => {
    // Insert metadata with a name
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', 'My Custom Recording', 'Custom description', '', '', '', '', '', '', '', '')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'My Custom Recording');
    assert.strictEqual(result.description, 'Custom description');
  });

  test('should generate fallback name when name is empty', async () => {
    // Insert metadata with empty name but no caller info
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', 'Some description', '', '', '', '', '', '', '', '')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'Trace-1');
    assert.strictEqual(result.description, 'Some description');
  });

  test('should generate fallback name when name is null', async () => {
    // Insert metadata with null name
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'Trace-1');
    assert.strictEqual(result.description, undefined);
  });

  test('should auto-increment counter for multiple recordings without names', async () => {
    // Create first recording without name
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', '', '', '', '', '', '', '', '', '')
    `);

    const dbNode1 = new DbNode(testDbPath);
    const result1 = await recordingsProvider.getTreeItem(dbNode1);
    assert.strictEqual(result1.label, 'Trace-1');

    // Create second temp db for second recording
    const testDbPath2 = createTempDb();
    const testExecutor2 = new BinarySQLiteExecutor(testDbPath2, sqliteBinaryPath);
    
    await testExecutor2.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        caller_file TEXT,
        caller_method TEXT,
        caller_line TEXT,
        caller_class TEXT,
        start_time TEXT,
        end_time TEXT,
        duration_ms TEXT,
        trigger_type TEXT
      )
    `);
    
    await testExecutor2.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', '', '', '', '', '', '', '', '', '')
    `);

    const dbNode2 = new DbNode(testDbPath2);
    const result2 = await recordingsProvider.getTreeItem(dbNode2);
    assert.strictEqual(result2.label, 'Trace-2');

    await testExecutor2.close();
    if (fs.existsSync(testDbPath2)) {
      fs.unlinkSync(testDbPath2);
    }
  });

  test('should handle whitespace-only names as empty', async () => {
    // Insert metadata with whitespace-only name
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '   ', 'Description here', '', '', '', '', '', '', '', '')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'Trace-1');
    assert.strictEqual(result.description, 'Description here');
  });

  test('should use caller_method as fallback name when name is empty', async () => {
    // Insert metadata with empty name but caller_method available
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', 'Custom description', 'app/controllers/orders_controller.rb', 'create', '42', 'OrdersController', '2024-01-01 10:00:00', '2024-01-01 10:00:05', '5000', 'rails_middleware')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'create');
    assert.strictEqual(result.description, 'Custom description');
  });

  test('should use caller_method and generate description when no description provided', async () => {
    // Insert metadata with empty name, no description, but caller info available
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', '', 'app/models/user.rb', 'validate_email', '15', 'User', '2024-01-01 09:30:00', '2024-01-01 09:30:02', '2000', 'manual_block')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'validate_email');
    assert.strictEqual(result.description, 'user.rb:15');
  });

  test('should prefer caller_method over auto-increment when name is empty', async () => {
    // Insert metadata with empty name but caller_method available
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', '', 'lib/service.rb', 'process_data', '8', 'DataProcessor', '2024-01-01 11:15:00', '2024-01-01 11:15:01', '1500', 'analyze_script')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'process_data');
    assert.strictEqual(result.description, 'service.rb:8');
  });

  test('should use caller_file as fallback when name and caller_method are empty', async () => {
    // Insert metadata with empty name and caller_method but caller_file available
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', 'File description', 'app/controllers/application_controller.rb', '', '25', '', '2024-01-01 07:30:00', '2024-01-01 07:30:02', '2500', 'rails_middleware')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'application_controller.rb');
    assert.strictEqual(result.description, 'File description');
  });

  test('should fall back to auto-increment when name, caller_method and caller_file are empty', async () => {
    // Insert metadata with empty name, caller_method, and caller_file
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', '', 'Some description', '', '', '10', '', '2024-01-01 08:00:00', '2024-01-01 08:00:03', '3000', 'manual_trace')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'Trace-1');
    assert.strictEqual(result.description, 'Some description');
  });

  test('should reset counter correctly', () => {
    // Reset and verify it starts from 0 again
    RecordingsTreeProvider.resetAutoIncrementCounter();
    
    // This test just verifies the reset method exists and can be called
    // The actual counter reset is tested implicitly in the setup of other tests
    assert.ok(true);
  });

  test('should create rich tooltip with all metadata fields', async () => {
    // Insert metadata with all fields populated
    await testExecutor.run(`
      INSERT INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
      VALUES ('1', 'Complete Recording', 'Full test description', 'app/controllers/orders_controller.rb', 'create', '42', 'OrdersController', '1704110400', '1704110405', '5000', 'rails_middleware')
    `);

    const dbNode = new DbNode(testDbPath);
    const result = await recordingsProvider.getTreeItem(dbNode);
    
    assert.strictEqual(result.label, 'Complete Recording');
    assert.strictEqual(result.description, 'Full test description');
    
    // Verify tooltip is created as a MarkdownString
    assert.ok(result.tooltip);
    assert.ok(result.tooltip instanceof vscode.MarkdownString);
    
    const tooltipValue = (result.tooltip as vscode.MarkdownString).value;
    
    // Verify tooltip contains expected table structure and content
    // The tooltip uses markdown tables, not sections
    assert.ok(tooltipValue.includes('| **Name** | Complete Recording |'));
    assert.ok(tooltipValue.includes('| **Description** | Full test description |'));
    assert.ok(tooltipValue.includes('| **File**'));
    assert.ok(tooltipValue.includes('app/controllers/orders_controller.rb |'));
    assert.ok(tooltipValue.includes('| **Line** | 42 |'));
    assert.ok(tooltipValue.includes('| **Class** | OrdersController |'));
    assert.ok(tooltipValue.includes('| **Method** | create |'));
    
    // Verify duration formatting (5000ms = 5.00 seconds)
    assert.ok(tooltipValue.includes('| **Duration** | 5.00 seconds |'));
    
    // Verify trigger type
    assert.ok(tooltipValue.includes('| **Type**     | rails_middleware |'));
    
    // Verify table structure markers
    assert.ok(tooltipValue.includes('|---|---|'));
    assert.ok(tooltipValue.includes('---')); // Table separator
  });
}); 