import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DeleteRecordingHandler } from '../../../../components/recordings/deleteRecordingHandler';
import { DbNode } from '../../../../components/recordings/dbNode';
import { CurrentState } from '../../../../state/currentState';

suite('DeleteRecordingHandler Test Suite', () => {
  const testDataDir = path.join(__dirname, '../../../../../.code-beacon/test');
  const testDbPath = path.join(testDataDir, 'test_recording.db');

  setup(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    // Create a dummy database file for testing
    if (!fs.existsSync(testDbPath)) {
      fs.writeFileSync(testDbPath, 'dummy db content');
    }
  });

  teardown(async () => {
    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should handle invalid DbNode gracefully', async () => {
    // Create a DbNode with invalid path
    const invalidDbNode = new DbNode('');
    
    // Mock vscode.window.showErrorMessage to capture the error
    let errorMessage = '';
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = async (message: string) => {
      errorMessage = message;
      return undefined;
    };

    try {
      await DeleteRecordingHandler.deleteRecording(invalidDbNode);
      assert.strictEqual(errorMessage, 'Invalid recording selected for deletion.');
    } finally {
      // Restore original method
      vscode.window.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('should clear current state when deleting active recording', async () => {
    const dbNode = new DbNode(testDbPath);
    dbNode.setName('Test Recording');

    // Set this as the current active recording
    CurrentState.setCurrentNode(null);
    
    // Mock the confirmation dialog to return 'Delete'
    const originalShowWarningMessage = vscode.window.showWarningMessage;
    vscode.window.showWarningMessage = async (): Promise<string | undefined> => 'Delete';

    // Mock the info message
    const originalShowInformationMessage = vscode.window.showInformationMessage;
    let successMessage = '';
    vscode.window.showInformationMessage = async (message: string) => {
      successMessage = message;
      return undefined;
    };

    try {
      await DeleteRecordingHandler.deleteRecording(dbNode);
      
      // Verify the file was deleted
      assert.strictEqual(fs.existsSync(testDbPath), false);
      
      // Verify success message was shown
      assert.strictEqual(successMessage.includes('deleted successfully'), true);
      
    } finally {
      // Restore original methods
      vscode.window.showWarningMessage = originalShowWarningMessage;
      vscode.window.showInformationMessage = originalShowInformationMessage;
    }
  });

  test('should handle user cancellation gracefully', async () => {
    const dbNode = new DbNode(testDbPath);
    dbNode.setName('Test Recording');

    // Mock the confirmation dialog to return 'Cancel'
    const originalShowWarningMessage = vscode.window.showWarningMessage;
    vscode.window.showWarningMessage = async (): Promise<string | undefined> => 'Cancel';

    try {
      await DeleteRecordingHandler.deleteRecording(dbNode);
      
      // Verify the file was NOT deleted
      assert.strictEqual(fs.existsSync(testDbPath), true);
      
    } finally {
      // Restore original method
      vscode.window.showWarningMessage = originalShowWarningMessage;
    }
  });
}); 