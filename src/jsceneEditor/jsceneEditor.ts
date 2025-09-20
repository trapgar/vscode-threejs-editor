import * as vscode from 'vscode';
import { EXTENSION_PREFIX, EXTENSION_SHORTHAND } from '../constants';
import { getNonce } from '../utils';

/**
 * Provider for jscene editors.
 *
 * JScene editors are used for `.jscene` files, which are internally json.
 *
 * This provider demonstrates:
 *
 * - How to implement a custom editor for binary files.
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Communication between VS Code and the custom editor.
 * - Using CustomDocuments to store information that is shared between multiple custom editors.
 * - Implementing save, undo, redo, and revert.
 * - Backing up a custom editor.
 */
export class JSceneEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new JSceneEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(
			JSceneEditorProvider.viewType,
			provider,
			// Initial render isn't super fast... need to check if this can be improved
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			}
		);
		context.subscriptions.push(
			...[
				'todo',
			].map(type => {
				return vscode.commands.registerCommand(`${EXTENSION_PREFIX}.addToTheProject.${type}`, () => {
					provider.webview?.postMessage({ type: 'add.basic', object: type });
				});
			}),
			...[
				'directional',
				'point',
				'spot',
				'rect',
				'sky',
			].map(light => {
				return vscode.commands.registerCommand(`${EXTENSION_PREFIX}.addToTheProject.lights.${light}`, () => {
					provider.webview?.postMessage({ type: 'add.light', light });
				});
			}),
			...[
				'cube',
				'sphere',
				'cone',
				'plane'
			].map(shape => {
				return vscode.commands.registerCommand(`${EXTENSION_PREFIX}.addToTheProject.shapes.${shape}`,
					() => {
						provider.webview?.postMessage({ type: 'add.shape', shape });
					}
				);
			}),
			...Object.values(provider.statusBarItems)
		);

		return providerRegistration;
	}

	private static readonly viewType = `${EXTENSION_SHORTHAND}.jscene`;
	private webview?: vscode.Webview;
	// TODO: Add items for the currently selected object
	private statusBarItems: {
		objects: vscode.StatusBarItem;
		vertices: vscode.StatusBarItem;
		triangles: vscode.StatusBarItem;
		frametime: vscode.StatusBarItem;
	};

	constructor(
		private readonly context: vscode.ExtensionContext
	) {
		this.statusBarItems = {
			objects: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200),
			vertices: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200),
			triangles: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200),
			frametime: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200),
		};

		for (const item of Object.values(this.statusBarItems))
			item.show();
	}

	/** Called when our custom editor is opened. */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		this.webview = webviewPanel.webview;
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		webviewPanel.onDidChangeViewState(e => {
			if (e.webviewPanel.active) {
				webviewPanel.webview.postMessage({ type: 'focus' });
				vscode.commands.executeCommand(`workbench.view.${EXTENSION_SHORTHAND}.sceneExplorer`);

				this.statusBarItems.objects.show();
				this.statusBarItems.vertices.show();
				this.statusBarItems.triangles.show();
				this.statusBarItems.frametime.show();
			}
			else {
				webviewPanel.webview.postMessage({ type: 'blur' });

				for (const item of Object.values(this.statusBarItems))
					item.hide();
			}
		});

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'stats':
					const { objects, vertices, triangles, frametime } = e;
					this.statusBarItems.objects.text = `${objects} objects`;
					this.statusBarItems.vertices.text = `${vertices} vertices`;
					this.statusBarItems.triangles.text = `${triangles} triangles`;
					this.statusBarItems.frametime.text = `${frametime.toFixed(2)} render time`;
					return;
				case 'scenegraphchanged':
					const { state } = e;
					this.handleSceneGraphChanged(document, state);
					return;
			}
		});

		updateWebview();
	}

	private handleSceneGraphChanged(document: vscode.TextDocument, newState: any) {
		this.updateTextDocument(document, newState);
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'sceneEditor.js'));
		const threeEditorUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'libs', 'three.viewport.min.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'sceneEditor.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>THREE.js Scene Editor</title>
			</head>
			<body>
				<div id="root" class="loading"></div>

				<script nonce="${nonce}" src="${threeEditorUri}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}
}
