import * as vscode from 'vscode';
import { RemoteTracingService } from './remoteTracingService';
import { StatusBarProvider } from './statusBarProvider';
import { remoteTracingConfigChangedEventEmitter } from '../../eventEmitter';

/**
 * Handles all remote tracing commands for the command palette
 */
export class CommandHandlers {
  private remoteTracingService: RemoteTracingService;
  private statusBarProvider?: StatusBarProvider;

  constructor(remoteTracingService: RemoteTracingService, statusBarProvider?: StatusBarProvider) {
    this.remoteTracingService = remoteTracingService;
    this.statusBarProvider = statusBarProvider;
    
    // Set up event listener for config file changes
    remoteTracingConfigChangedEventEmitter.event(() => {
      this.handleInitialize();
    });
  }

  /**
   * Registers all remote tracing commands
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand(
        'codeBeacon.initializeRemoteTracing',
        () => this.handleInitialize()
      ),

      // Main toggle command
      vscode.commands.registerCommand(
        'codeBeacon.toggleRemoteTracing',
        () => this.handleToggle()
      ),

      // Explicit allow command
      vscode.commands.registerCommand(
        'codeBeacon.allowRemoteTracing',
        () => this.handleAllow()
      ),

      // Explicit block command
      vscode.commands.registerCommand(
        'codeBeacon.blockRemoteTracing',
        () => this.handleBlock()
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

  async handleInitialize(): Promise<void> {
    if ( await this.remoteTracingService.validateConfiguration() ) {
      const isCurrentlyEnabled = await this.remoteTracingService.isTracingEnabled();

      if (isCurrentlyEnabled) {
        this.updateUIContext('allowed');
        await this.updateStatusBar(true);
      } else {
        this.updateUIContext('blocked');
        await this.updateStatusBar(false);
      }
    } else {
      this.updateUIContext('error');
      await this.handleConfigError('error');
    }
  }

  private async handleToggle(): Promise<void> {
      const isCurrentlyEnabled = await this.remoteTracingService.isTracingEnabled();

      if (isCurrentlyEnabled) {
        await this.handleBlock();
      } else {
        await this.handleAllow();
    }
  }

  private async handleAllow(): Promise<void> {
    try {
      await this.remoteTracingService.enableTracing();
      await this.updateStatusBar(true);
      this.updateUIContext('allowed');
    } catch (error) {
      this.updateUIContext('error');
      await this.handleConfigError(error);
    }
  }

  private async handleBlock(): Promise<void> {
    try {
      await this.remoteTracingService.disableTracing();
      await this.updateStatusBar(false);
      this.updateUIContext('blocked');
    } catch (error) {
      this.updateUIContext('error');
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

  private updateUIContext(state: 'allowed' | 'blocked' | 'error') {
    vscode.commands.executeCommand('setContext', 'codeBeacon.remoteTracing.state', state);
  }
} 