import { JSceneEditorProvider } from './jsceneEditor/jsceneEditor';
import * as vscode from 'vscode';
import SceneEditorPanel from './sceneEditor/sceneEditorPanel';
import { Dependency, SceneOutlineProvider } from './sceneOutliner';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-threejs-editor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const sceneOutlineProvider = new SceneOutlineProvider(rootPath);

	context.subscriptions.push(
		vscode.commands.registerCommand('gamejs.helloWorld', () => SceneEditorPanel.createOrShow(context.extensionUri)),

		vscode.window.registerTreeDataProvider('sceneOutliner', sceneOutlineProvider),
		vscode.commands.registerCommand('sceneOutliner.refreshList', () => sceneOutlineProvider.refresh()),
		vscode.commands.registerCommand('sceneOutliner.viewActorDetails',
			instanceId => vscode.commands.executeCommand('objectDetails.focus')
		),
		vscode.commands.registerCommand('sceneOutliner.deleteEntry', (node: Dependency) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`)),
		vscode.commands.registerCommand('vscode-threejs-editor.addMesh', () => {
			vscode.window.showInformationMessage('Add Command Executed!');
		}),

		JSceneEditorProvider.register(context),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
