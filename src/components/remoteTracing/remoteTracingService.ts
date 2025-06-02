import * as vscode from 'vscode';
import { ConfigFileManager } from './configFileManager';
import { TracerConfig } from './types';
import { IConfig } from '../../config';

/**
 * Main service for managing remote tracing communication
 * Orchestrates configuration file operations and state management
 */
export class RemoteTracingService {
  private configFileManager: ConfigFileManager;
  private config: IConfig;

  constructor(config: IConfig) {
    this.config = config;
    this.configFileManager = new ConfigFileManager(this.config.getRemoteTracingConfigPath());
  }

  /**
   * Gets the current remote tracing configuration
   */
  async getCurrentConfig(): Promise<TracerConfig> {
    return await this.configFileManager.readConfig();
  }

  /**
   * Checks if remote tracing is currently enabled
   * Returns false if configuration is invalid
   */
  async isTracingEnabled(): Promise<boolean> {
    try {
      const config = await this.getCurrentConfig();
      return config.tracing_enabled;
    } catch (error) {
      // Configuration is invalid, consider tracing disabled
      return false;
    }
  }

  /**
   * Allows remote tracing
   */
  async enableTracing(): Promise<void> {
    await this.configFileManager.updateTracingEnabled(true);
  }

  /**
   * Blocks remote tracing
   */
  async disableTracing(): Promise<void> {
    await this.configFileManager.updateTracingEnabled(false);
  }

  /**
   * Updates the entire configuration
   */
  async updateConfig(config: TracerConfig): Promise<void> {
    await this.configFileManager.writeConfig(config);
  }

  /**
   * Gets the configuration file path
   */
  getConfigPath(): string {
    return this.config.getRemoteTracingConfigPath();
  }

  /**
   * Validates that the configuration system is working
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      await this.getCurrentConfig();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Creates an example configuration file
   */
  async createExampleConfig(): Promise<string> {
    return await this.configFileManager.createExampleConfig();
  }

  /**
   * Handles configuration errors by showing a simple dialog
   */
  async handleConfigError(error: string): Promise<void> {
    const action = await vscode.window.showErrorMessage(
      `Remote tracing configuration error: ${error}`,
      'Open Example File',
      'Open Config File'
    );

    if (action === 'Open Example File') {
      try {
        const examplePath = await this.createExampleConfig();
        const uri = vscode.Uri.file(examplePath);
        await vscode.window.showTextDocument(uri);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to create example file: ${err}`);
      }
    } else if (action === 'Open Config File') {
      try {
        const uri = vscode.Uri.file(this.getConfigPath());
        await vscode.window.showTextDocument(uri);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to open config file: ${err}`);
      }
    }
  }
} 