import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import { createConfig } from '../../config';

export class SqliteSetupService {
    /**
     * Ensures SQLite binary path is set and valid
     */
    public async ensureSetup(): Promise<boolean> {
        const config = createConfig();
        const sqlitePath = config.getSqliteBinaryPath();
        
        // Check if SQLite path is already set and valid
        if (sqlitePath && fs.existsSync(sqlitePath) && this.isExecutable(sqlitePath)) {
            return true;
        }
        
        // Set context for welcome view
        vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'sqlitePathNotSet');
        
        // Try to auto-detect SQLite binary
        const detectedPath = await this.detectSqliteBinaryPath();
        if (detectedPath) {
            const useDetected = 'Use Detected Path';
            const configurePath = 'Configure Manually';
            
            const response = await vscode.window.showInformationMessage(
                `SQLite binary found at: ${detectedPath}. Use this path?`,
                useDetected,
                configurePath
            );
            
            if (response === useDetected) {
                // Save the detected path to configuration
                await vscode.workspace.getConfiguration().update(
                    'code-beacon.sqliteBinaryPath',
                    detectedPath,
                    vscode.ConfigurationTarget.Global
                );
                
                return true;
            } else if (response === configurePath) {
                return await this.configureSqlitePath();
            }
        } else {
            // Show notification to configure SQLite path manually
            const configureNow = 'Configure Now';
            const response = await vscode.window.showWarningMessage(
                'SQLite binary path is not configured. This is required for Code Beacon to function properly.',
                configureNow
            );
            
            if (response === configureNow) {
                const result = await this.configureSqlitePath();
                if (result) {
                    return true;
                }
            }
        }
        
        // SQLite path still not set - leave the welcome view in 'sqlitePathNotSet' state
        return false;
    }

    /**
     * Attempts to auto-detect SQLite binary on the system
     */
    private async detectSqliteBinaryPath(): Promise<string | undefined> {
        const platform = os.platform();
        let possiblePaths: string[] = [];
        let whichCommand = 'which';
        
        // Define common locations based on platform
        if (platform === 'win32') {
            whichCommand = 'where';
            possiblePaths = [
                'C:\\Program Files\\SQLite\\sqlite3.exe',
                'C:\\Program Files (x86)\\SQLite\\sqlite3.exe',
                'C:\\sqlite\\sqlite3.exe'
            ];
        } else if (platform === 'darwin') {
            possiblePaths = [
                '/usr/bin/sqlite3',
                '/usr/local/bin/sqlite3',
                '/opt/homebrew/bin/sqlite3',
                '/opt/local/bin/sqlite3'
            ];
        } else if (platform === 'linux') {
            possiblePaths = [
                '/usr/bin/sqlite3',
                '/usr/local/bin/sqlite3',
                '/opt/bin/sqlite3'
            ];
        }
        
        // Check if sqlite3 is in PATH using which/where
        try {
            const { stdout } = await this.execPromise(`${whichCommand} sqlite3`);
            const pathFromCommand = stdout.trim();
            if (pathFromCommand && fs.existsSync(pathFromCommand) && this.isExecutable(pathFromCommand)) {
                return pathFromCommand;
            }
        } catch (error) {
            // Command failed, continue with the check of predefined paths
        }
        
        // Check predefined paths
        for (const potentialPath of possiblePaths) {
            if (fs.existsSync(potentialPath) && this.isExecutable(potentialPath)) {
                return potentialPath;
            }
        }
        
        // Check if homebrew can locate sqlite
        if (platform === 'darwin' || platform === 'linux') {
            try {
                const { stdout } = await this.execPromise('brew --prefix sqlite');
                const brewPrefix = stdout.trim();
                if (brewPrefix) {
                    const brewPath = path.join(brewPrefix, 'bin', 'sqlite3');
                    if (fs.existsSync(brewPath) && this.isExecutable(brewPath)) {
                        return brewPath;
                    }
                }
            } catch (error) {
                // Homebrew not installed or command failed
            }
        }
        
        return undefined;
    }

    /**
     * Promisified child_process.exec
     */
    private execPromise(command: string): Promise<{ stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            cp.exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }

    /**
     * Allows the user to manually configure the SQLite path
     */
    private async configureSqlitePath(): Promise<boolean> {
        // Allow user to enter path manually
        const sqlitePath = await vscode.window.showInputBox({
            prompt: 'Enter the path to your SQLite binary (sqlite3)',
            placeHolder: 'e.g., /usr/bin/sqlite3, C:\\sqlite\\sqlite3.exe',
            validateInput: (value) => {
                if (!value) {
                    return 'Path cannot be empty';
                }
                
                if (!fs.existsSync(value)) {
                    return 'File does not exist';
                }
                
                if (!this.isExecutable(value)) {
                    return 'File is not executable';
                }
                
                return null; // input is valid
            }
        });
        
        if (!sqlitePath) {
            return false;
        }
        
        // Save the path to configuration
        await vscode.workspace.getConfiguration().update(
            'code-beacon.sqliteBinaryPath',
            sqlitePath,
            vscode.ConfigurationTarget.Global
        );
      
        // Run a basic test to verify the binary works
        try {
            const testResult = await this.testSqliteBinary(sqlitePath);
            if (!testResult.success) {
                vscode.window.showErrorMessage(`Error testing SQLite binary: ${testResult.error}`);
                return false;
            }
            vscode.window.showInformationMessage('SQLite binary configured successfully.');
            return true;
        } catch (error) {
            console.error('Error testing SQLite binary:', error);
            vscode.window.showErrorMessage(`Error testing SQLite binary: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Tests if the SQLite binary works correctly
     */
    private async testSqliteBinary(binaryPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.execPromise(`"${binaryPath}" -version`);
            if (result.stderr) {
                return { success: false, error: result.stderr };
            }
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Checks if a file is executable
     */
    private isExecutable(filePath: string): boolean {
        try {
            // Check if file exists and has executable permissions
            const stats = fs.statSync(filePath);
            // 0o111 represents executable permissions (--x--x--x)
            return (stats.mode & 0o111) !== 0;
        } catch (error) {
            return false;
        }
    }
} 