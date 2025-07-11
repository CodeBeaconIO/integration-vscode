import * as assert from 'assert';
import { MetaDataAR, MetaDataARInterface } from '../../../state/activeRecord/metaDataAR';
import * as path from 'path';
import * as fs from 'fs';
import { BinarySQLiteExecutor } from '../../../services/sqlite/BinarySQLiteExecutor';
import * as os from 'os';
import * as cp from 'child_process';

function findSqliteBinary() {
    try {
        const whichCommand = os.platform() === 'win32' ? 'where' : 'which';
        const { stdout } = cp.spawnSync(whichCommand, ['sqlite3'], { encoding: 'utf8' });
        const binaryPath = stdout.trim().split('\n')[0];
        if (binaryPath && fs.existsSync(binaryPath)) {
            return binaryPath;
        }
    } catch {}
    const commonPaths = os.platform() === 'win32'
        ? ['C:\\Program Files\\SQLite\\sqlite3.exe', 'C:\\sqlite\\sqlite3.exe']
        : ['/usr/bin/sqlite3', '/usr/local/bin/sqlite3', '/opt/homebrew/bin/sqlite3'];
    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

suite('MetaDataAR Test Suite', function() {
    const sqliteBinaryPath = findSqliteBinary();
    if (!sqliteBinaryPath) {
        console.log('Skipping MetaDataAR tests - SQLite binary not found');
        return;
    }
    let metaData: MetaDataAR;
    let testExecutor: BinarySQLiteExecutor;
    const testDbPath = path.join(__dirname, '../../../../.code-beacon/db/test_metadata.db');

    const createMockData = (): Partial<MetaDataARInterface> => {
        return {
            id: '1',
            name: 'Test Profile',
            description: 'Test Description',
            caller_file: 'app/test.rb',
            caller_method: 'test_method',
            caller_line: '10',
            caller_class: 'TestClass',
            start_time: '2024-01-01 12:00:00',
            end_time: '2024-01-01 12:00:05',
            duration_ms: '5000',
            trigger_type: 'manual_block'
        };
    };

    async function insertTestData(data: Partial<MetaDataARInterface>): Promise<void> {
        await testExecutor.run(`
            INSERT OR REPLACE INTO metadata (id, name, description, caller_file, caller_method, caller_line, caller_class, start_time, end_time, duration_ms, trigger_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.id ?? '',
            data.name ?? '',
            data.description ?? '',
            data.caller_file ?? '',
            data.caller_method ?? '',
            data.caller_line ?? '',
            data.caller_class ?? '',
            data.start_time ?? '',
            data.end_time ?? '',
            data.duration_ms ?? '',
            data.trigger_type ?? ''
        ]);
    }

    setup(async () => {
        // Ensure the directory exists
        const dbDir = path.dirname(testDbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Ensure the test database file exists (NodeSQLiteExecutor requires it)
        if (!fs.existsSync(testDbPath)) {
            fs.writeFileSync(testDbPath, '');
        }

        // Create test executor with detected SQLite binary path
        testExecutor = new BinarySQLiteExecutor(testDbPath, sqliteBinaryPath);
        MetaDataAR.reconnectDb(testExecutor);
        // Create metadata instance
        metaData = new MetaDataAR(testDbPath);
        // Create test table
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
    });

    teardown(async () => {
        // Close the database connection
        if (testExecutor) {
            await testExecutor.close();
        }

        // Delete the test database file
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create MetaDataAR instance with correct properties', async () => {
        await insertTestData(createMockData());
        const instance = new MetaDataAR(testDbPath);
        assert.strictEqual(instance.dbBasename, path.basename(testDbPath));
    });

    test('should find metadata by ID', async () => {
        const mockData = createMockData();
        await insertTestData(mockData);
        const result = await metaData.findById(1);
        assert.strictEqual(result.id, mockData.id);
        assert.strictEqual(result.name, mockData.name);
        assert.strictEqual(result.description, mockData.description);
        assert.strictEqual(result.caller_file, mockData.caller_file);
        assert.strictEqual(result.caller_method, mockData.caller_method);
        assert.strictEqual(result.caller_line, mockData.caller_line);
        assert.strictEqual(result.caller_class, mockData.caller_class);
        assert.strictEqual(result.start_time, mockData.start_time);
        assert.strictEqual(result.end_time, mockData.end_time);
        assert.strictEqual(result.duration_ms, mockData.duration_ms);
        assert.strictEqual(result.trigger_type, mockData.trigger_type);
        assert.strictEqual(result.dbPath, testDbPath);
        assert.strictEqual(result.dbBasename, path.basename(testDbPath));
    });

    test('should reject when metadata ID is not found', async () => {
        try {
            await metaData.findById(999);
            assert.fail('Expected findById to reject for non-existent ID');
        } catch (error) {
            assert.strictEqual(error, null);
        }
    });

    test('should handle database query errors', async () => {
        // Drop the table to simulate a database error
        await testExecutor.exec('DROP TABLE metadata');

        try {
            await metaData.findById(1);
            assert.fail('Expected findById to reject when table does not exist');
        } catch (error) {
            assert.ok(error instanceof Error);
        }
    });

    test('should have reasonable defaults', () => {
        const instance = new MetaDataAR(testDbPath);
        assert.strictEqual(instance.id, '');
        assert.strictEqual(instance.name, '');
        assert.strictEqual(instance.description, '');
        assert.strictEqual(instance.dbBasename, path.basename(testDbPath));
    });
}); 