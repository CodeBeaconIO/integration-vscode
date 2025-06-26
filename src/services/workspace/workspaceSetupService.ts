import * as vscode from 'vscode';

// Interface for QuickPick items with value property
interface WorkspaceQuickPickItem extends vscode.QuickPickItem {
	value: string;
}

export class WorkspaceSetupService {
	/**
	 * Ensures workspace is properly set up (combines all validation checks)
	 */
	public async ensureWorkspaceSetup(): Promise<boolean> {
		return this.workspaceExists() && await this.ensureRootDirIsSetup();
	}

	/**
	 * Validates that workspace folders exist
	 */
	public workspaceExists(): boolean {
		if (!vscode.workspace.workspaceFolders) {
			vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'workspaceNotFound');
			return false;
		} else {
			return true;
		}
	}

	/**
	 * Handles the complex logic for setting up rootDir, including QuickPick for multi-root workspaces
	 */
	public async ensureRootDirIsSetup(): Promise<boolean> {
		if (!vscode.workspace.workspaceFolders) {
			return false;
		}

		const rootDirConfig = vscode.workspace.getConfiguration().get<string>('code-beacon.rootDir', '');
		
		// If rootDir is already configured and valid, keep it
		if (rootDirConfig && rootDirConfig.trim() !== '') {
			return true;
		}

		// For single workspace, auto-set the rootDir
		if (vscode.workspace.workspaceFolders.length === 1) {
			const singleWorkspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			await vscode.workspace.getConfiguration().update('code-beacon.rootDir', singleWorkspaceRoot, vscode.ConfigurationTarget.Workspace);
			return true;
		}

		// For multi-root workspace, show picker
		return await this.promptForWorkspaceRoot();
	}

	/**
	 * Shows QuickPick for selecting workspace root in multi-root scenarios
	 */
	public async promptForWorkspaceRoot(): Promise<boolean> {
		if (!vscode.workspace.workspaceFolders) {
			return false;
		}

		// For multi-root workspace, show picker with workspace options + custom option
		const quickPickItems: WorkspaceQuickPickItem[] = vscode.workspace.workspaceFolders.map(folder => {
			return {
				label: folder.name,
				description: folder.uri.fsPath,
				detail: `Workspace folder: ${folder.uri.fsPath}`,
				value: folder.uri.fsPath
			};
		});

		// Add custom path option
		quickPickItems.push({
			label: "$(folder) Choose Custom Directory...",
			description: "Browse for a custom directory",
			detail: "Select a directory outside of the workspace folders",
			value: '__custom__'
		});

		const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
			placeHolder: 'Choose a project root to enable Code Beacon on.',
			ignoreFocusOut: true
		});

		if (!selectedItem) {
			vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'rootNotSet');
			return false;
		}

		let selectedPath: string;

		if (selectedItem.value === '__custom__') {
			// Show folder picker for custom directory
			const customUri = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select Root Directory',
				title: 'Choose Custom Root Directory for Code Beacon'
			});

			if (!customUri || customUri.length === 0) {
				vscode.commands.executeCommand('setContext', 'codeBeaconContext.welcome', 'rootNotSet');
				return false;
			}

			selectedPath = customUri[0].fsPath;
		} else {
			selectedPath = selectedItem.value;
		}

		await vscode.workspace.getConfiguration().update('code-beacon.rootDir', selectedPath, vscode.ConfigurationTarget.Workspace);
		return true;
	}
} 