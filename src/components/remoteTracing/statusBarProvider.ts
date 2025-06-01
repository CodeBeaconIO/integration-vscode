import * as vscode from 'vscode';
import { RemoteTracingService } from './remoteTracingService';

/**
 * Provides status bar integration for remote tracing
 * Shows current tracing state and allows quick toggle
 */
export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;
  private remoteTracingService: RemoteTracingService;

  constructor(remoteTracingService: RemoteTracingService) {
    this.remoteTracingService = remoteTracingService;
    
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100 // Priority - higher numbers appear more to the left
    );
    
    // Set up the status bar item
    this.statusBarItem.command = 'codeBeacon.toggleRemoteTracing';
    this.statusBarItem.tooltip = 'Click to toggle remote tracing';
    
    // Show the status bar item
    this.statusBarItem.show();
    
    // Initialize the display
    this.updateDisplay();
  }

  /**
   * Updates the status bar display based on current tracing state
   */
  async updateDisplay(): Promise<void> {
    try {
      const isEnabled = await this.remoteTracingService.isTracingEnabled();
      
      if (isEnabled) {
        this.statusBarItem.text = '$(record) Remote Tracing: ON';
        this.statusBarItem.backgroundColor = undefined; // Default background
        this.statusBarItem.color = '#ff6b6b'; // Red color for active
        this.statusBarItem.tooltip = 'Remote tracing is active. Click to disable.';
      } else {
        this.statusBarItem.text = '$(circle-large-outline) Remote Tracing: OFF';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = '#6c757d'; // Gray color for inactive
        this.statusBarItem.tooltip = 'Remote tracing is inactive. Click to enable.';
      }
    } catch (error) {
      // Error state
      this.statusBarItem.text = '$(warning) Remote Tracing: ERROR';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.color = undefined;
      this.statusBarItem.tooltip = `Remote tracing error: ${error}. Click to retry.`;
    }
  }

  /**
   * Handles the toggle command
   */
  async handleToggle(): Promise<void> {
    try {
      const newState = await this.remoteTracingService.toggleTracing();
      await this.updateDisplay();
      
      // Show feedback message
      const message = newState 
        ? 'Remote tracing enabled - Ruby gem will start tracing'
        : 'Remote tracing disabled - existing traces remain available';
      vscode.window.showInformationMessage(message);
      
    } catch (error) {
      await this.updateDisplay();
      vscode.window.showErrorMessage(`Failed to toggle remote tracing: ${error}`);
    }
  }

  /**
   * Disposes of the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
} 