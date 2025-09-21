import * as vscode from 'vscode';
import { ActorOutlineProvider } from './actorOutliner';
import { EXTENSION_SHORTHAND, EXTENSION_VIEWTYPE } from './constants';
import { JSceneEditorProvider } from './jsceneEditor/jsceneEditor';
import SceneEditorPanel from './sceneEditor/sceneEditorPanel';
import { SceneGraphActor, SceneOutlineProvider } from './sceneOutliner';

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
	const actorOutlineProvider = new ActorOutlineProvider(rootPath);

	context.subscriptions.push(
		vscode.commands.registerCommand(`${EXTENSION_SHORTHAND}.helloWorld`, () => SceneEditorPanel.createOrShow(context.extensionUri)),

		vscode.window.registerTreeDataProvider('sceneOutliner', sceneOutlineProvider),
		vscode.window.registerTreeDataProvider('actorOutliner', actorOutlineProvider),
		vscode.commands.registerCommand('sceneOutliner.refreshList', () => {
			if (vscode.window.tabGroups.activeTabGroup.activeTab) {
				const { viewType, uri }: any = vscode.window.tabGroups.activeTabGroup.activeTab.input ?? {};
				if (viewType === EXTENSION_VIEWTYPE && uri)
					sceneOutlineProvider.handleChangedSceneGraph(uri);
			}
		}),
		vscode.commands.registerCommand('sceneOutliner.viewActorDetails', actor => actorOutlineProvider.handleChangedActor(actor)),
		vscode.commands.registerCommand('sceneOutliner.deleteEntry', (node: SceneGraphActor) => {
			vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`);
		}),
		vscode.commands.registerCommand('vscode-threejs-editor.addMesh', () => {
			vscode.window.showInformationMessage('Add Command Executed!');
		}),

		JSceneEditorProvider.register(context),
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
