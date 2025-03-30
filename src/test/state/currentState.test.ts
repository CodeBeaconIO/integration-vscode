import * as assert from 'assert';
import * as vscode from 'vscode';
import { CurrentState } from '../../state/currentState';
import { TreeNodeDataAR } from '../../state/activeRecord/treeNodeDataAR';
import { TracedFile } from '../../components/editor/tracedFile';

suite('CurrentState Test Suite', () => {
    let mockTreeNode: TreeNodeDataAR;

    setup(() => {
        // Reset the static state before each test
        CurrentState.setCurrentNode(null);
        
        // Create a mock TreeNodeDataAR
        mockTreeNode = {
            getFile: () => '/test/file.ts',
            getLineRanges: () => [{ line: 1 }, { line: 2 }]
        } as TreeNodeDataAR;
    });

    suite('currentNode', () => {
        test('should return null when no node is set', () => {
            assert.strictEqual(CurrentState.currentNode(), null);
        });

        test('should return the current node when set', () => {
            CurrentState.setCurrentNode(mockTreeNode);
            assert.strictEqual(CurrentState.currentNode(), mockTreeNode);
        });
    });

    suite('matches', () => {
        setup(() => {
            CurrentState.setCurrentNode(mockTreeNode);
        });

        test('should match file path string when current node exists', () => {
            assert.strictEqual(CurrentState.matches('/test/file.ts'), true);
        });

        test('should not match different file path string', () => {
            assert.strictEqual(CurrentState.matches('/different/file.ts'), false);
        });

        test('should match file path and line number when line exists', () => {
            assert.strictEqual(CurrentState.matches('/test/file.ts', 1), true);
        });

        test('should not match file path and line number when line does not exist', () => {
            assert.strictEqual(CurrentState.matches('/test/file.ts', 3), false);
        });

        test('should match TracedFile when file path matches', () => {
            const uri = vscode.Uri.file('/test/file.ts');
            const tracedFile = new TracedFile(uri);
            assert.strictEqual(CurrentState.matches(tracedFile), true);
        });

        test('should match TracedFile with correct line number', () => {
            const uri = vscode.Uri.file('/test/file.ts');
            const tracedFile = new TracedFile(uri);
            assert.strictEqual(CurrentState.matches(tracedFile, 1), true);
        });

        test('should return false when no current node exists', () => {
            CurrentState.setCurrentNode(null);
            assert.strictEqual(CurrentState.matches('/test/file.ts'), false);
        });
    });
}); 