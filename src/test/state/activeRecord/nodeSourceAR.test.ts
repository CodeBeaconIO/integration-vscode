import * as assert from 'assert';
import * as vscode from 'vscode';
import { NodeSourceAR } from '../../../state/activeRecord/nodeSourceAR';
import * as path from 'path';
import * as fs from 'fs';
import { NodeSQLiteExecutor } from '../../../services/sqlite/NodeSQLiteExecutor';

suite('NodeSourceAR Test Suite', () => {
    const createMockNodeSourceData = () => {
        return {
            id: '1',
            name: 'test_source',
            root_path: '/test/path'
        };
    };

    let nodeSource: NodeSourceAR;
    let testExecutor: NodeSQLiteExecutor;
    const testDbDir = path.join(__dirname, '../../../../.code-beacon/db');
    const testDbName = 'test.db';
    const testDbPath = path.join(testDbDir, testDbName);

    async function insertTestData(data: { id: string, name: string, root_path: string }): Promise<void> {
        await testExecutor.run(`
            INSERT OR REPLACE INTO node_sources 
            (id, name, root_path)
            VALUES (?, ?, ?)
        `, [
            data.id,
            data.name,
            data.root_path
        ]);
    }

    setup(async () => {
        // Ensure the directory exists
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }

        // Ensure the test database file exists (NodeSQLiteExecutor requires it)
        if (!fs.existsSync(testDbPath)) {
            fs.writeFileSync(testDbPath, '');
        }

        // Create test executor (NodeSQLiteExecutor)
        testExecutor = new NodeSQLiteExecutor(testDbPath);
        // Create test table
        await testExecutor.exec(`
            CREATE TABLE IF NOT EXISTS node_sources (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE,
                root_path TEXT
            )
        `);
        NodeSourceAR.reconnectDb(testExecutor);
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

    test('should return correct id', () => {
        nodeSource = new NodeSourceAR(createMockNodeSourceData());
        assert.strictEqual(nodeSource.id, '1');
    });

    test('should return correct name', () => {
        nodeSource = new NodeSourceAR(createMockNodeSourceData());
        assert.strictEqual(nodeSource.name, 'test_source');
    });

    test('should return correct root path', () => {
        nodeSource = new NodeSourceAR(createMockNodeSourceData());
        assert.strictEqual(nodeSource.rootPath, '/test/path');
    });

    test('should get node source by URI', async () => {
        const mockData = createMockNodeSourceData();
        await insertTestData(mockData);
        await NodeSourceAR.loadAll();

        const uri = vscode.Uri.file('/test/path/some/file.ts');
        const result = NodeSourceAR.getByUri(uri);
        
        assert.ok(result !== null);
        if (result) {
            assert.strictEqual(result.name, mockData.name);
            assert.strictEqual(result.rootPath, mockData.root_path);
        }
    });

    test('should return null for URI not matching any root path', async () => {
        const mockData = createMockNodeSourceData();
        await insertTestData(mockData);
        await NodeSourceAR.loadAll();

        const uri = vscode.Uri.file('/different/path/file.ts');
        const result = NodeSourceAR.getByUri(uri);
        
        assert.strictEqual(result, null);
    });

    test('should get node source by name', async () => {
        const mockData = createMockNodeSourceData();
        await insertTestData(mockData);
        await NodeSourceAR.loadAll();

        const result = NodeSourceAR.getByName('test_source');
        assert.strictEqual(result.name, mockData.name);
        assert.strictEqual(result.rootPath, mockData.root_path);
    });

    test('should throw error when getting non-existent node source by name', async () => {
        await NodeSourceAR.loadAll();

        assert.throws(() => {
            NodeSourceAR.getByName('non_existent_source');
        }, Error);
    });

    test('should load all node sources', async () => {
        // Clear the existing map first
        await NodeSourceAR.loadAll(); // This will clear and reload the empty map
        
        const mockData1 = createMockNodeSourceData();
        const mockData2 = {
            id: '2',
            name: 'test_source_2',
            root_path: '/test/path2'
        };

        await insertTestData(mockData1);
        await insertTestData(mockData2);
        await NodeSourceAR.loadAll(); // Load the newly inserted data

        // Now check both the direct database query and the loaded map
        const allSources = await NodeSourceAR.all();
        assert.strictEqual(allSources.length, 2);
        assert.ok(allSources.some(source => source.name === mockData1.name));
        assert.ok(allSources.some(source => source.name === mockData2.name));

        // Verify the loaded map
        const source1 = NodeSourceAR.getByName(mockData1.name);
        const source2 = NodeSourceAR.getByName(mockData2.name);
        assert.ok(source1);
        assert.ok(source2);
        assert.strictEqual(source1.name, mockData1.name);
        assert.strictEqual(source2.name, mockData2.name);
    });

    test('should find node source by id', async () => {
        const mockData = createMockNodeSourceData();
        await insertTestData(mockData);

        const result = await NodeSourceAR.findById(1);
        assert.ok(result !== null);
        if (result) {
            assert.strictEqual(result.name, mockData.name);
            assert.strictEqual(result.rootPath, mockData.root_path);
        }
    });

    test('should find node source by name', async () => {
        const mockData = createMockNodeSourceData();
        await insertTestData(mockData);

        const result = await NodeSourceAR.findByName('test_source');
        assert.ok(result !== null);
        if (result) {
            assert.strictEqual(result.id, mockData.id);
            assert.strictEqual(result.rootPath, mockData.root_path);
        }
    });

    test('should return null when finding non-existent node source', async () => {
        const result = await NodeSourceAR.findById(999);
        assert.strictEqual(result, null);

        const resultByName = await NodeSourceAR.findByName('non_existent');
        assert.strictEqual(resultByName, null);
    });
}); 