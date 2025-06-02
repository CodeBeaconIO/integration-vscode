import * as vscode from 'vscode';
import { RemoteTracingService } from './remoteTracingService';
import { StatusBarProvider } from './statusBarProvider';

/**
 * Handles all remote tracing commands for the command palette
 */
export class CommandHandlers {
  private remoteTracingService: RemoteTracingService;
  private statusBarProvider?: StatusBarProvider;

  constructor(remoteTracingService: RemoteTracingService, statusBarProvider?: StatusBarProvider) {
    this.remoteTracingService = remoteTracingService;
    this.statusBarProvider = statusBarProvider;
  }

  /**
   * Registers all remote tracing commands
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // Main toggle command
      vscode.commands.registerCommand(
        'codeBeacon.toggleRemoteTracing',
        () => this.handleToggle()
      ),

      // Explicit enable command
      vscode.commands.registerCommand(
        'codeBeacon.enableRemoteTracing',
        () => this.handleEnable()
      ),

      // Explicit disable command
      vscode.commands.registerCommand(
        'codeBeacon.disableRemoteTracing',
        () => this.handleDisable()
      ),

      // Open config file command
      vscode.commands.registerCommand(
        'codeBeacon.openRemoteTracingConfig',
        () => this.handleOpenConfig()
      ),

      // Handle error command (for status bar click)
      vscode.commands.registerCommand(
        'codeBeacon.handleRemoteTracingError',
        () => this.handleError()
      )
    ];

    context.subscriptions.push(...commands);
  }

  private async updateStatusBar(enable: boolean): Promise<void> {
    if (this.statusBarProvider) {
      await this.statusBarProvider.updateDisplay(enable);
    }
  }

  private async handleToggle(): Promise<void> {
      const isCurrentlyEnabled = await this.remoteTracingService.isTracingEnabled();

      if (isCurrentlyEnabled) {
        await this.handleDisable();
      } else {
        await this.handleEnable();
    }
  }

  private async handleEnable(): Promise<void> {
    try {
      await this.remoteTracingService.enableTracing();
      await this.updateStatusBar(true);
    } catch (error) {
      await this.handleConfigError(error);
    }
  }

  private async handleDisable(): Promise<void> {
    try {
      await this.remoteTracingService.disableTracing();
      await this.updateStatusBar(false);
    } catch (error) {
      await this.handleConfigError(error);
    }
  }

  /**
   * Handles opening the configuration file
   */
  private async handleOpenConfig(): Promise<void> {
    try {
      const configPath = this.remoteTracingService.getConfigPath();
      const uri = vscode.Uri.file(configPath);
      
      // Try to ensure the config file exists by reading it (this will create it if needed)
      await this.remoteTracingService.getCurrentConfig();
      await vscode.window.showTextDocument(uri);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open configuration file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handles configuration errors
   */
  private async handleConfigError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update status bar to show error state
    if (this.statusBarProvider) {
      this.statusBarProvider.setErrorState();
    }
    
    // Show error dialog with options
    await this.remoteTracingService.handleConfigError(errorMessage);
  }

  /**
   * Handles error command (called when status bar error is clicked)
   */
  private async handleError(): Promise<void> {
    try {
      // Try to get current config to see what the error is
      await this.remoteTracingService.getCurrentConfig();
      // If we get here, config is valid now, update status bar
      const isEnabled = await this.remoteTracingService.isTracingEnabled();
      await this.updateStatusBar(isEnabled);
    } catch (error) {
      await this.handleConfigError(error);
    }
  }
} 