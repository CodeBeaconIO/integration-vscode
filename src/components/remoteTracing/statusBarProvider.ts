import * as vscode from 'vscode';

/**
 * Provides status bar integration for remote tracing
 * Shows current tracing state and allows specific allow/block actions
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
    this.statusBarItem.show();
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
    this.statusBarItem.hide();
  }

  /**
   * Sets the status bar to show disabled state
   */
  private setDisabledState(): void {
    this.statusBarItem.show();
    this.statusBarItem.text = '$(stop-circle) Remote Tracing: BLOCKED';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    this.statusBarItem.command = 'codeBeacon.allowRemoteTracing'; // Specific allow command
    this.statusBarItem.tooltip = 'VS Code blocks Ruby gem from tracing (click to allow)';
  }

  /**
   * Disposes of the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
} 