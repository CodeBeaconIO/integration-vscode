// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Config } from './config';
import { AppTreeProvider } from './components/methodDirectory/appTreeProvider';
import { RecordingsTreeProvider } from './components/recordings/recordingsViewProvider';
import { Coordinator } from './coordinator';
import { DBManager } from './state/db/manager';
import SQLite3Connection from './state/db/sqlite3Connection';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Event handler for when the codeBeacon viewContainer is revealed
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	if (!(workspaceExists() && await validRootDir() && await ensureRootDirIsSetup())) {
		return Promise.reject();
	}
	 
	vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'workspaceFound');

	// const dataPath = '/tmp/call_trace.json';
	const recordingsDataProvider = new RecordingsTreeProvider();
	vscode.window.registerTreeDataProvider('recordingsTree', recordingsDataProvider);
	const appDataProvider = new AppTreeProvider();
	vscode.window.registerTreeDataProvider('appTree', appDataProvider);

	const coordinator = new Coordinator(recordingsDataProvider);
	coordinator.initialize();
	
	try {
		SQLite3Connection.getDatabase();
	} catch (error) {
		vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'dbMissing');
	}
	
	const dbManager = new DBManager(Config.refreshPath);
	dbManager.startWatching();
	context.subscriptions.push({
		dispose: () => {
			dbManager.stopWatching();
		}
	});
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
