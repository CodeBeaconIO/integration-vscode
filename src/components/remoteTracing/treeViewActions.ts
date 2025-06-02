import * as vscode from 'vscode';

/**
 * Provides tree view toolbar actions for remote tracing
 * 
 * Note: Tree view uses commands registered in CommandHandlers to avoid duplication
 * and ensure consistent behavior across all UI contexts.
 */
export class TreeViewActions {
  constructor() {
    // Tree view actions now delegate to CommandHandlers commands
  }

  /**
   * Registers tree view commands and context menu items
   * 
   * Note: Tree view now uses commands registered in CommandHandlers:
   * - 'codeBeacon.toggleRemoteTracing' for toggle action
   * - 'codeBeacon.openRemoteTracingConfig' for config access
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  registerCommands(context: vscode.ExtensionContext): void {
    // No commands registered here - tree view uses CommandHandlers commands directly
    // This eliminates duplication and ensures consistent behavior
  }
}
