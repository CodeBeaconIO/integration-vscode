import * as assert from 'assert';
import { MetaDataAR, MetaDataARInterface } from '../../../state/activeRecord/metaDataAR';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

suite('MetaDataAR Test Suite', () => {
    let metaData: MetaDataAR;
    let testDb: sqlite3.Database;
    const testDbPath = path.join(__dirname, '../../../../.code-beacon/db/test_metadata.db');

    const createMockData = (): Partial<MetaDataARInterface> => {
        return {
            id: '1',
            name: 'Test Profile',
            description: 'Test Description'
        };
    };

    async function insertTestData(db: sqlite3.Database, data: Partial<MetaDataARInterface>): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO metadata (id, name, description)
                VALUES (?, ?, ?)
            `, [
                data.id,
                data.name,
                data.description
            ], (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }

    setup(async () => {
        // Ensure the directory exists
        const dbDir = path.dirname(testDbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Create test database
        testDb = new sqlite3.Database(testDbPath);
        MetaDataAR.reconnectDb(testDb);
        
        // Create metadata instance
        metaData = new MetaDataAR(testDbPath);
        
        // Create test table
        await new Promise<void>((resolve, reject) => {
            testDb.run(`
                CREATE TABLE IF NOT EXISTS metadata (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    description TEXT
                )
            `, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    });

    teardown(async () => {
        // Close the database connection
        if (testDb) {
            await new Promise<void>((resolve, reject) => {
                testDb.close((err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve();
                });
            });
        }

        // Delete the test database file
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should create MetaDataAR instance with correct properties', async () => {
        await insertTestData(testDb, createMockData());
        const instance = new MetaDataAR(testDbPath);
        assert.strictEqual(instance.dbBasename, path.basename(testDbPath));
    });

    test('should find metadata by ID', async () => {
        const mockData = createMockData();
        await insertTestData(testDb, mockData);
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
        await new Promise<void>((resolve) => {
            testDb.run('DROP TABLE metadata', () => {
                resolve();
            });
        });

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