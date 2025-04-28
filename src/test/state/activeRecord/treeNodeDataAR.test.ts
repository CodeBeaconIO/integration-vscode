import * as assert from 'assert';
import { TreeNodeDataAR, TreeNodeDataARInterface } from '../../../state/activeRecord/treeNodeDataAR';
import { NodeSQLiteExecutor } from '../../../services/sqlite/NodeSQLiteExecutor';
import { SQLiteExecutor } from '../../../services/sqlite/SQLiteExecutor';

suite('TreeNodeDataAR Test Suite', () => {
    const createMockNodeData = (): TreeNodeDataARInterface => {
        return {
            id: '1',
            file: '/test/file.rb',
            line: '10',
            method: 'test_method',
            depth: 1,
            gemEntry: 0,
            isDepthTruncated: 0,
            parent_id: null,
            block: 0,
            caller: 'caller:5',
            return_value: 'test_return',
            script: 0,
            tp_class_name: 'TestClass'
        };
    };

    const createMockChildNodeData = (): TreeNodeDataARInterface => {
      return {
        id: '2',
        file: '/test/file.rb',
        line: '20',
        method: 'child_method',
        depth: 2,
        gemEntry: 0,
        isDepthTruncated: 0,
        parent_id: '1',
        block: 0,
        caller: 'caller:10',
        return_value: 'child_return',
        script: 0,
        tp_class_name: 'TestClass'
      };
    };

    let treeNode: TreeNodeDataAR;
    let testExecutor: SQLiteExecutor;

    async function insertTestData(data: TreeNodeDataARInterface): Promise<void> {
        await testExecutor.run(`
            INSERT OR REPLACE INTO treenodes 
            (id, file, line, method, depth, gemEntry, isDepthTruncated, parent_id, block, caller, return_value, script, tp_class_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.id,
            data.file,
            data.line,
            data.method,
            data.depth,
            data.gemEntry,
            data.isDepthTruncated,
            data.parent_id,
            data.block,
            data.caller,
            data.return_value,
            data.script,
            data.tp_class_name
        ]);
    }

    setup(async () => {
        // Create in-memory database for testing
        testExecutor = new NodeSQLiteExecutor(':memory:');
        
        // Create test table
        await testExecutor.exec(`
            CREATE TABLE IF NOT EXISTS treenodes (
                id TEXT PRIMARY KEY,
                file TEXT,
                line TEXT,
                method TEXT,
                depth INTEGER,
                gemEntry INTEGER,
                isDepthTruncated INTEGER,
                parent_id TEXT,
                block INTEGER,
                caller TEXT,
                return_value TEXT,
                script INTEGER,
                tp_class_name TEXT
            )
        `);

        TreeNodeDataAR.reconnectDb(testExecutor);
    });

    teardown(async () => {
        // Close the database connection
        if (testExecutor) {
            await testExecutor.close();
        }
    });

    test('should return correct getMethod', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getMethod(), 'test_method');
    });

    test('should return correct getLine', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getLine(), '10');
    });

    test('should return correct display name', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.displayName(), 'test_method');
        
        const blockNode = new TreeNodeDataAR({ ...createMockNodeData(), block: 1 });
        assert.strictEqual(blockNode.displayName(), 'block');
    });

    test('should handle depth property correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getDepth(), 1);
        treeNode.depth = 2;
        assert.strictEqual(treeNode.getDepth(), 2);
    });

    test('should handle file property correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getFile(), '/test/file.rb');
        treeNode.file = '/new/test/file.rb';
        assert.strictEqual(treeNode.getFile(), '/new/test/file.rb');
    });

    test('should handle gem entry flag correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getIsGemEntry(), false);
        const gemNode = new TreeNodeDataAR({ ...createMockNodeData(), gemEntry: 1 });
        assert.strictEqual(gemNode.getIsGemEntry(), true);
    });

    test('should handle depth truncation correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getIsDepthTruncated(), false);
        treeNode.setDepthTruncated(true);
        assert.strictEqual(treeNode.getIsDepthTruncated(), true);
    });

    test('should return correct line ranges', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        const ranges = treeNode.getLineRanges();
        assert.deepStrictEqual(ranges, [{ line: 10 }]);
    });

    test('should handle invalid line numbers in line ranges', () => {
        const invalidNode = new TreeNodeDataAR({ 
            ...createMockNodeData(), 
            line: 'invalid'
        });
        const ranges = invalidNode.getLineRanges();
        assert.deepStrictEqual(ranges, []);
    });

    test('should return all lines correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        const lines = treeNode.getAllLines();
        assert.deepStrictEqual(lines, [10]);
    });

    test('should return correct parent id', () => { 
        const node = new TreeNodeDataAR({ 
          ...createMockNodeData(), 
          parent_id: '10'
        });
        assert.strictEqual(node.getParentId(), '10');
    });
    
    test('should handle caller information correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getCaller(), 'caller:5');
        assert.strictEqual(treeNode.getCallerLine(), 4); // 5-1 because of zero-based indexing
    });

    test('should identify root nodes correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        assert.strictEqual(treeNode.getIsRoot(), true);
        const childNode = new TreeNodeDataAR({ ...createMockNodeData(), parent_id: '1' });
        assert.strictEqual(childNode.getIsRoot(), false);
    });

    test('should create null object correctly', () => {
        treeNode = new TreeNodeDataAR(createMockNodeData());
        const nullNode = TreeNodeDataAR.nullObject();
        assert.strictEqual(nullNode.getId(), '');
        assert.strictEqual(nullNode.getFile(), '');
        assert.strictEqual(nullNode.getLine(), '');
        assert.strictEqual(nullNode.getMethod(), '');
        assert.strictEqual(nullNode.getDepth(), 0);
        assert.strictEqual(nullNode.getIsGemEntry(), false);
        assert.strictEqual(nullNode.getIsDepthTruncated(), false);
        assert.strictEqual(nullNode.getParentId(), null);
        assert.strictEqual(nullNode.getIsBlock(), false);
        assert.strictEqual(nullNode.getCaller(), '');
        assert.strictEqual(nullNode.getReturnVal(), '');
        assert.strictEqual(nullNode.getIsScript(), false);
        assert.deepStrictEqual(nullNode.getLineRanges(), []);
        assert.deepStrictEqual(nullNode.getAllLines(), []);
        assert.strictEqual(nullNode.getIsRoot(), true);
    });

    // Database-related tests
    test('should find node by ID', async () => {
        await insertTestData(createMockNodeData());
        const result = await TreeNodeDataAR.findById(1);
        assert.ok(result !== null);
        if (result) {
            assert.strictEqual(result.getMethod(), createMockNodeData().method);
            assert.strictEqual(result.getFile(), createMockNodeData().file);
        }
    });

    test('should find node by file and line', async () => {
        await insertTestData(createMockNodeData());
        const result = await TreeNodeDataAR.findByFileAndLine(createMockNodeData().file, parseInt(createMockNodeData().line));
        assert.ok(result !== null);
        if (result) {
            assert.strictEqual(result.getMethod(), createMockNodeData().method);
            assert.strictEqual(result.getLine(), createMockNodeData().line);
        }
    });

    test('should check for children correctly', async () => {
        await insertTestData(createMockNodeData());
        await insertTestData(createMockChildNodeData());

        const hasChildren = await treeNode.hasChildren();
        assert.strictEqual(hasChildren, true);
    });

    test('should find all nodes by file', async () => {
        await insertTestData(createMockNodeData());
        await insertTestData(createMockChildNodeData());

        const nodes = await TreeNodeDataAR.findAllNodesByFile(createMockNodeData().file);
        assert.strictEqual(nodes.length, 2); // Original node and child node
        const methods = nodes.map(node => node.getMethod());
        assert.ok(methods.includes('test_method'));
        assert.ok(methods.includes('child_method'));
    });

    test('should find all calls from file', async () => {
        await insertTestData(createMockNodeData());
        await insertTestData(createMockChildNodeData());

        const calls = await TreeNodeDataAR.findAllCallsFromFile(createMockNodeData().file);
        assert.strictEqual(calls.length, 1); // Only the child node
        assert.strictEqual(calls[0].getMethod(), 'child_method');
        assert.strictEqual(calls[0].getParentId(), createMockNodeData().id);
    });

    test('should find all lines executed by file', async () => {
        await insertTestData(createMockNodeData());
        await insertTestData(createMockChildNodeData());

        const lines = await TreeNodeDataAR.findAllLinesExecutedByFile(createMockNodeData().file);
        assert.deepStrictEqual(lines.sort(), [10, 20]); // Both original and child node lines
    });

    test('should find all method count by class', async () => {
        await insertTestData(createMockNodeData());

        const classes = await TreeNodeDataAR.findAllMethodCountByClass("tp_class_name = 'TestClass'");
        assert.strictEqual(classes.length, 1);
        assert.strictEqual(classes[0].file, createMockNodeData().file);
        assert.strictEqual(classes[0].className, 'TestClass');
    });

    test('should find all method count by file', async () => {
        await insertTestData(createMockNodeData());
        await insertTestData(createMockChildNodeData());

        const files = await TreeNodeDataAR.findAllMethodCountByFile(`file = '${createMockNodeData().file}'`);
        assert.strictEqual(files.length, 1);
        assert.strictEqual(files[0].file, createMockNodeData().file);
        assert.strictEqual(files[0].methodCount, 2); // Both methods are counted
    });

    test('should find all files', async () => {
        await insertTestData(createMockNodeData());

        const files = await TreeNodeDataAR.findAllFiles();
        assert.deepStrictEqual(files, [createMockNodeData().file]);
    });
}); 