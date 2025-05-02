import * as assert from 'assert';
import { MetaDataAR, MetaDataARInterface } from '../../../state/activeRecord/metaDataAR';
import * as path from 'path';
import * as fs from 'fs';
import { NodeSQLiteExecutor } from '../../../services/sqlite/NodeSQLiteExecutor';

suite('MetaDataAR Test Suite', () => {
    let metaData: MetaDataAR;
    let testExecutor: NodeSQLiteExecutor;
    const testDbPath = path.join(__dirname, '../../../../.code-beacon/db/test_metadata.db');

    const createMockData = (): Partial<MetaDataARInterface> => {
        return {
            id: '1',
            name: 'Test Profile',
            description: 'Test Description'
        };
    };

    async function insertTestData(data: Partial<MetaDataARInterface>): Promise<void> {
        await testExecutor.run(`
            INSERT OR REPLACE INTO metadata (id, name, description)
            VALUES (?, ?, ?)
        `, [
            data.id ?? '',
            data.name ?? '',
            data.description ?? ''
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

        // Create test executor (NodeSQLiteExecutor)
        testExecutor = new NodeSQLiteExecutor(testDbPath);
        MetaDataAR.reconnectDb(testExecutor);
        // Create metadata instance
        metaData = new MetaDataAR(testDbPath);
        // Create test table
        await testExecutor.exec(`
            CREATE TABLE IF NOT EXISTS metadata (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT
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