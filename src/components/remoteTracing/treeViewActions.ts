import * as vscode from 'vscode';
import { RemoteTracingService } from './remoteTracingService';
import { StatusBarProvider } from './statusBarProvider';

/**
 * Provides tree view toolbar actions for remote tracing
 */
export class TreeViewActions {
  private remoteTracingService: RemoteTracingService;
  private statusBarProvider?: StatusBarProvider;

  constructor(remoteTracingService: RemoteTracingService, statusBarProvider?: StatusBarProvider) {
    this.remoteTracingService = remoteTracingService;
    this.statusBarProvider = statusBarProvider;
  }

  /**
   * Registers tree view commands and context menu items
   */
  registerCommands(context: vscode.ExtensionContext): void {
    // Register the toggle command for tree view toolbar
    const toggleCommand = vscode.commands.registerCommand(
      'codeBeacon.toggleRemoteTracingFromTree',
      async () => {
        await this.handleToggleFromTree();
      }
    );

    // Register the status command for showing current state
    const statusCommand = vscode.commands.registerCommand(
      'codeBeacon.showRemoteTracingStatus',
      async () => {
        await this.showStatus();
      }
    );

    context.subscriptions.push(toggleCommand, statusCommand);
  }

  /**
   * Updates the status bar if available
   */
  private async updateStatusBar(): Promise<void> {
    if (this.statusBarProvider) {
      await this.statusBarProvider.updateDisplay();
    }
  }

  /**
   * Handles toggle from tree view toolbar
   */
  private async handleToggleFromTree(): Promise<void> {
    try {
      const newState = await this.remoteTracingService.toggleTracing();
      await this.updateStatusBar();
      
      const action = newState ? 'enabled' : 'disabled';
      const icon = newState ? '🔴' : '⚫';
      
      vscode.window.showInformationMessage(
        `${icon} Remote tracing ${action}`,
        'Show Status'
      ).then(selection => {
        if (selection === 'Show Status') {
          this.showStatus();
        }
      });
      
    } catch (error) {
      await this.updateStatusBar();
      vscode.window.showErrorMessage(`Failed to toggle remote tracing: ${error}`);
    }
  }

  /**
   * Shows detailed status information
   */
  private async showStatus(): Promise<void> {
    try {
      const config = await this.remoteTracingService.getCurrentConfig();
      const configPath = this.remoteTracingService.getConfigPath();
      
      const statusMessage = `
Remote Tracing Status:
• State: ${config.tracing_enabled ? 'ENABLED 🔴' : 'DISABLED ⚫'}
• Last Updated: ${new Date(config.last_updated).toLocaleString()}
• Source: ${config.source}
• Config File: ${configPath}
• Include Paths: ${config.filters?.include_paths?.join(', ') || 'None'}
• Exclude Patterns: ${config.filters?.exclude_patterns?.join(', ') || 'None'}
      `.trim();

      const action = config.tracing_enabled ? 'Disable' : 'Enable';
      
      vscode.window.showInformationMessage(
        statusMessage,
        action,
        'Open Config File'
      ).then(async selection => {
        if (selection === action) {
          await this.remoteTracingService.toggleTracing();
        } else if (selection === 'Open Config File') {
          const uri = vscode.Uri.file(configPath);
          await vscode.window.showTextDocument(uri);
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get remote tracing status: ${error}`);
    }
  }
} 