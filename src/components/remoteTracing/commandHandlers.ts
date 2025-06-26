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
      ),

      vscode.commands.registerCommand(
        'codeBeacon.excludeRecordingLikeThis',
        (treeItem: vscode.TreeItem) => this.handleExcludeRecordingLikeThis(treeItem)
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

  private async handleExcludeRecordingLikeThis(treeItem: vscode.TreeItem): Promise<void> {
    // Expecting a DbNode from recordings tree – try to read label/description robustly
    let nameDefault = '';
    if (typeof treeItem.label === 'string') {
      nameDefault = treeItem.label;
    } else if (treeItem.label && typeof (treeItem.label as vscode.TreeItemLabel).label === 'string') {
      nameDefault = (treeItem.label as vscode.TreeItemLabel).label;
    }

    const descProp = (treeItem as { description?: unknown }).description;
    const descDefault = typeof descProp === 'string' ? descProp : '';

    const namePattern = await vscode.window.showInputBox({
      value: nameDefault,
      prompt: 'Name pattern - supports * wildcard and other glob patterns'
    });
    if (namePattern === undefined) {
      return; // cancelled
    }

    const descPattern = await vscode.window.showInputBox({
      value: descDefault,
      prompt: 'Description pattern - supports * wildcard and other glob patterns'
    });
    if (descPattern === undefined) {
      return;
    }

    try {
      const cfg = await this.remoteTracingService.getCurrentConfig();
      const newRule = { name: namePattern, description: descPattern } as import('./types').MetaExcludeRule;
      const filters = cfg.filters ?? {};
      const rules = filters.recording_meta_exclude ?? [];
      rules.push(newRule);
      const newConfig = {
        ...cfg,
        filters: {
          ...filters,
          recording_meta_exclude: rules
        }
      } as import('./types').TracerConfig;

      await this.remoteTracingService.updateConfig(newConfig);

      const action = await vscode.window.showInformationMessage('Exclude rule added. Open config to see all rules.', 'Open Config');
      if (action === 'Open Config') {
        await this.handleOpenConfig();
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to add exclude rule: ${err}`);
    }
  }
} 