import * as vscode from 'vscode';
import { remoteTracingConfigChangedEventEmitter } from '../../eventEmitter';

/**
 * Watches the remote tracing configuration file for changes
 * Emits events when the file is created, modified, or deleted
 */
export class ConfigFileWatcher {
  private watcher: vscode.FileSystemWatcher;
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
    
    // Create file system watcher for the specific config file
    this.watcher = vscode.workspace.createFileSystemWatcher(
      configPath,
      false, // Don't ignore create events
      false, // Don't ignore change events  
      false  // Don't ignore delete events
    );
  }

  /**
   * Start watching the config file for changes
   */
  startWatching(): void {
    this.watcher.onDidCreate(() => this.onConfigChange());
    this.watcher.onDidChange(() => this.onConfigChange());
    this.watcher.onDidDelete(() => this.onConfigChange());
  }

  /**
   * Stop watching and dispose of the watcher
   */
  stopWatching(): void {
    this.watcher.dispose();
  }

  /**
   * Handle config file changes by emitting an event
   */
  private onConfigChange(): void {
    remoteTracingConfigChangedEventEmitter.fire();
  }
} 