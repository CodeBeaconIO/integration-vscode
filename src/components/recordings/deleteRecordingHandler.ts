import * as vscode from 'vscode';
import { DbNode } from './dbNode';
import { recordingDeletedEventEmitter, newDbEventEmitter } from '../../eventEmitter';
import { CurrentState } from '../../state/currentState';
import { SQLiteConnection } from '../../state/db/sqliteConnection';
import path from 'path';

export class DeleteRecordingHandler {
  static async deleteRecording(dbNode: DbNode): Promise<void> {
    if (!dbNode || !dbNode.dbPath) {
      vscode.window.showErrorMessage('Invalid recording selected for deletion.');
      return;
    }

    const recordingName = dbNode.name || path.basename(dbNode.dbPath);
    
    // Show confirmation dialog
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the recording "${recordingName}"?`,
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (result !== 'Delete') {
      return;
    }

    try {
      // Check if this is the currently active recording
      const currentDbUri = CurrentState.currentDbUri();
      const isCurrentlyActive = currentDbUri && currentDbUri.fsPath === dbNode.dbPath;

      if (isCurrentlyActive) {
        // Clear current state and close any active connections
        CurrentState.setCurrentNode(null);
        SQLiteConnection.clearInstance();
      }

      // Delete the file
      const fileUri = vscode.Uri.file(dbNode.dbPath);
      await vscode.workspace.fs.delete(fileUri);

      // Fire events to notify other components
      recordingDeletedEventEmitter.fire({ uri: fileUri });
      newDbEventEmitter.fire({ uri: fileUri });

      // Show success message
      vscode.window.showInformationMessage(`Recording "${recordingName}" deleted successfully.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      vscode.window.showErrorMessage(`Failed to delete recording: ${errorMessage}`);
      console.error('Error deleting recording:', error);
    }
  }
} 