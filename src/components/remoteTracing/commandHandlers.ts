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

      // Status command
      vscode.commands.registerCommand(
        'codeBeacon.showRemoteTracingStatus',
        () => this.handleShowStatus()
      ),

      // Open config file command
      vscode.commands.registerCommand(
        'codeBeacon.openRemoteTracingConfig',
        () => this.handleOpenConfig()
      ),

      // Validate configuration command
      vscode.commands.registerCommand(
        'codeBeacon.validateRemoteTracingConfig',
        () => this.handleValidateConfig()
      )
    ];

    context.subscriptions.push(...commands);
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
   * Handles the toggle command
   */
  private async handleToggle(): Promise<void> {
    try {
      const newState = await this.remoteTracingService.toggleTracing();
      await this.updateStatusBar();
      
      const message = newState 
        ? 'Remote tracing enabled - Ruby gem will start tracing'
        : 'Remote tracing disabled - existing traces remain available';
      
      vscode.window.showInformationMessage(message);
    } catch (error) {
      await this.updateStatusBar();
      vscode.window.showErrorMessage(`Failed to toggle remote tracing: ${error}`);
    }
  }

  /**
   * Handles the enable command
   */
  private async handleEnable(): Promise<void> {
    try {
      const isAlreadyEnabled = await this.remoteTracingService.isTracingEnabled();
      
      if (isAlreadyEnabled) {
        vscode.window.showInformationMessage('Remote tracing is already enabled');
        return;
      }

      await this.remoteTracingService.enableTracing();
      await this.updateStatusBar();
    } catch (error) {
      await this.updateStatusBar();
      vscode.window.showErrorMessage(`Failed to enable remote tracing: ${error}`);
    }
  }

  /**
   * Handles the disable command
   */
  private async handleDisable(): Promise<void> {
    try {
      const isEnabled = await this.remoteTracingService.isTracingEnabled();
      
      if (!isEnabled) {
        vscode.window.showInformationMessage('Remote tracing is already disabled');
        return;
      }

      await this.remoteTracingService.disableTracing();
      await this.updateStatusBar();
    } catch (error) {
      await this.updateStatusBar();
      vscode.window.showErrorMessage(`Failed to disable remote tracing: ${error}`);
    }
  }

  /**
   * Handles the show status command
   */
  private async handleShowStatus(): Promise<void> {
    try {
      const config = await this.remoteTracingService.getCurrentConfig();
      const configPath = this.remoteTracingService.getConfigPath();
      
      const statusItems = [
        `State: ${config.tracing_enabled ? 'ENABLED 🔴' : 'DISABLED ⚫'}`,
        `Last Updated: ${new Date(config.last_updated).toLocaleString()}`,
        `Source: ${config.source}`,
        `Version: ${config.version}`,
        `Config File: ${configPath}`
      ];

      if (config.filters) {
        if (config.filters.include_paths?.length) {
          statusItems.push(`Include Paths: ${config.filters.include_paths.join(', ')}`);
        }
        if (config.filters.exclude_patterns?.length) {
          statusItems.push(`Exclude Patterns: ${config.filters.exclude_patterns.join(', ')}`);
        }
      }

      const statusMessage = `Remote Tracing Status:\n${statusItems.map(item => `• ${item}`).join('\n')}`;
      
      const actions = ['Toggle State', 'Open Config', 'Validate Config'];
      
      const selection = await vscode.window.showInformationMessage(
        statusMessage,
        ...actions
      );

      switch (selection) {
        case 'Toggle State':
          await this.handleToggle();
          break;
        case 'Open Config':
          await this.handleOpenConfig();
          break;
        case 'Validate Config':
          await this.handleValidateConfig();
          break;
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get remote tracing status: ${error}`);
    }
  }

  /**
   * Handles opening the configuration file
   */
  private async handleOpenConfig(): Promise<void> {
    try {
      const configPath = this.remoteTracingService.getConfigPath();
      const uri = vscode.Uri.file(configPath);
      
      // Ensure the config file exists by reading it (this will create it if needed)
      await this.remoteTracingService.getCurrentConfig();
      
      await vscode.window.showTextDocument(uri);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open configuration file: ${error}`);
    }
  }

  /**
   * Handles validating the configuration
   */
  private async handleValidateConfig(): Promise<void> {
    try {
      const isValid = await this.remoteTracingService.validateConfiguration();
      
      if (isValid) {
        vscode.window.showInformationMessage('✅ Remote tracing configuration is valid');
      } else {
        vscode.window.showWarningMessage('⚠️ Remote tracing configuration has issues');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to validate configuration: ${error}`);
    }
  }
} 