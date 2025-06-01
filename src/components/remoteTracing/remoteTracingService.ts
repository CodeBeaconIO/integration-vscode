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
   */
  async isTracingEnabled(): Promise<boolean> {
    const config = await this.getCurrentConfig();
    return config.tracing_enabled;
  }

  /**
   * Enables remote tracing
   */
  async enableTracing(): Promise<void> {
    try {
      await this.configFileManager.updateTracingEnabled(true);
      vscode.window.showInformationMessage('Remote tracing enabled - Ruby gem will start tracing');
    } catch (error) {
      const errorMessage = `Failed to enable remote tracing: ${error}`;
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      throw error;
    }
  }

  /**
   * Disables remote tracing
   */
  async disableTracing(): Promise<void> {
    try {
      await this.configFileManager.updateTracingEnabled(false);
      vscode.window.showInformationMessage('Remote tracing disabled - existing traces remain available');
    } catch (error) {
      const errorMessage = `Failed to disable remote tracing: ${error}`;
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      throw error;
    }
  }

  /**
   * Toggles remote tracing state
   */
  async toggleTracing(): Promise<boolean> {
    const currentlyEnabled = await this.isTracingEnabled();
    
    if (currentlyEnabled) {
      await this.disableTracing();
      return false;
    } else {
      await this.enableTracing();
      return true;
    }
  }

  /**
   * Updates the entire configuration
   */
  async updateConfig(config: TracerConfig): Promise<void> {
    try {
      await this.configFileManager.writeConfig(config);
    } catch (error) {
      const errorMessage = `Failed to update remote tracing configuration: ${error}`;
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      throw error;
    }
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
      // Try to read the configuration
      await this.getCurrentConfig();
      return true;
    } catch (error) {
      console.error('Configuration validation failed:', error);
      vscode.window.showErrorMessage('Failed to communicate with Ruby gem - check configuration');
      return false;
    }
  }
} 