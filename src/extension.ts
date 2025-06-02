// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createConfig } from './config';
import { AppTreeProvider } from './components/methodDirectory/appTreeProvider';
import { RecordingsTreeProvider } from './components/recordings/recordingsViewProvider';
import { Coordinator } from './coordinator';
import { DBManager } from './state/db/manager';
import { SQLiteConnection } from './state/db/sqliteConnection';
import { SqliteSetupService } from './services/sqlite/sqliteSetupService';
import { RemoteTracingService, StatusBarProvider, TreeViewActions, CommandHandlers, ConfigFileWatcher } from './components/remoteTracing';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const config = createConfig();
	// Event handler for when the codeBeacon viewContainer is revealed
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	if (!(workspaceExists() && await validRootDir() && await ensureRootDirIsSetup())) {
		return Promise.reject();
	}
	 
	vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'workspaceFound');
	
	// Check SQLite binary path before proceeding with activation
	const sqliteSetupService = new SqliteSetupService();
	if (!(await sqliteSetupService.ensureSetup())) {
		// If SQLite path is not set, keep the welcome view showing the need for SQLite configuration
		// and don't proceed with full activation
		return;
	}
	
	try {
		SQLiteConnection.getExecutor();
	} catch (error) {
		vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'dbMissing');
	}
	
	// Check if tracing is enabled before initializing the extension
	const tracingEnabled = vscode.workspace.getConfiguration('code-beacon').get('tracingEnabled', true);
	if (!tracingEnabled) {
		vscode.window.showInformationMessage('Tracing is disabled. Enable it in settings to start tracing.');
		return;
	}
	
	function initializeExtension() {
		const dbManager = new DBManager(config.getRefreshPath());
		dbManager.registerCommandHandlers();
		dbManager.startWatching();
		context.subscriptions.push({
			dispose: () => {
				dbManager.stopWatching();
			}
		});
		const recordingsDataProvider = new RecordingsTreeProvider();
		vscode.window.registerTreeDataProvider('recordingsTree', recordingsDataProvider);
		const appDataProvider = new AppTreeProvider();
		vscode.window.registerTreeDataProvider('appTree', appDataProvider);

		const coordinator = new Coordinator(recordingsDataProvider);
		coordinator.initialize();
		
		// Initialize remote tracing components
		const remoteTracingService = new RemoteTracingService(config);
		const statusBarProvider = new StatusBarProvider();
		const treeViewActions = new TreeViewActions();
		const commandHandlers = new CommandHandlers(remoteTracingService, statusBarProvider);
		
		// Initialize config file watcher
		const configFileWatcher = new ConfigFileWatcher(config.getRemoteTracingConfigPath());
		configFileWatcher.startWatching();
		
		// Register all remote tracing commands
		commandHandlers.registerCommands(context);
		treeViewActions.registerCommands(context);
		vscode.commands.executeCommand('codeBeacon.initializeRemoteTracing');

		// Add status bar to disposables
		context.subscriptions.push(statusBarProvider);
		context.subscriptions.push({
			dispose: () => configFileWatcher.stopWatching()
		});
	}
	
	initializeExtension();
}

function workspaceExists(): boolean {
	if (!vscode.workspace.workspaceFolders) {
		vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'workspaceNotFound');
		return false;
	} else {
		return true;
	}
}

function validRootDir(): Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		return Promise.resolve(false);
	}
	const rootDir = vscode.workspace.getConfiguration().get('code-beacon.rootDir', '');
	if (rootDir && !vscode.workspace.workspaceFolders.some(folder => folder.uri.fsPath === rootDir)) {
		// vscode.window.showErrorMessage('Invalid root directory set in configuration \'code-beacon.rootDir\'. It must match one of the workspace root folders.');
		return Promise.resolve(false);
	}
	return Promise.resolve(true);
}

async function ensureRootDirIsSetup(): Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		return false;
	}
	const rootDirConfig = vscode.workspace.getConfiguration().get('code-beacon.rootDir', '');
	if (rootDirConfig) {
		const rootDir = rootDirConfig;
		await vscode.workspace.getConfiguration().update('code-beacon.rootDir', rootDir, vscode.ConfigurationTarget.Workspace);
		return true;
	}
	const quickPickItems = vscode.workspace.workspaceFolders.map(folder => {
		return {
			label: folder.name,
			description: folder.uri.fsPath,
		};
	});
	const selectedUri = await vscode.window.showQuickPick(quickPickItems, {
		placeHolder: 'Choose a project root to enable Code Beacon on.',
	});
	if (!selectedUri) {
		vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'rootNotSet');
		return false;
	}
	await vscode.workspace.getConfiguration().update('code-beacon.rootDir', selectedUri.description, vscode.ConfigurationTarget.Workspace);
	return true;
}

// This method is called when your extension is deactivated
export function deactivate() {}
