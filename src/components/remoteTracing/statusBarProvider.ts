import * as vscode from 'vscode';

/**
 * Provides status bar integration for remote tracing
 * Shows current tracing state and allows specific enable/disable actions
 */
export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.show();
  }

  async updateDisplay(enable: boolean | undefined = undefined): Promise<void> {
    try {
      if (enable) {
        this.setEnabledState();
      } else {
        this.setDisabledState();
      }
    } catch (error) {
      this.setErrorState();
    }
  }

  /**
   * Sets the status bar to show error state for configuration issues
   */
  setErrorState(): void {
    this.statusBarItem.text = '$(warning) Remote Tracing: ERROR';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.statusBarItem.color = undefined;
    this.statusBarItem.command = 'codeBeacon.handleRemoteTracingError';
    this.statusBarItem.tooltip = 'Remote tracing configuration error. Click to fix.';
  }

  /**
   * Sets the status bar to show enabled state
   */
  private setEnabledState(): void {
    this.statusBarItem.text = '$(record) Remote Tracing: ON';
    this.statusBarItem.backgroundColor = undefined; // Default background
    this.statusBarItem.color = '#ff6b6b'; // Red color for active
    this.statusBarItem.command = 'codeBeacon.disableRemoteTracing'; // Specific disable command
    this.statusBarItem.tooltip = 'Remote tracing is active. Click to disable.';
  }

  /**
   * Sets the status bar to show disabled state
   */
  private setDisabledState(): void {
    this.statusBarItem.text = '$(circle-large-outline) Remote Tracing: OFF';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = '#6c757d'; // Gray color for inactive
    this.statusBarItem.command = 'codeBeacon.enableRemoteTracing'; // Specific enable command
    this.statusBarItem.tooltip = 'Remote tracing is inactive. Click to enable.';
  }

  /**
   * Disposes of the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
} 