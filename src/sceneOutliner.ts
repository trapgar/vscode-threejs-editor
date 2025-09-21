import * as vscode from 'vscode';
import * as path from 'path';
import fs from 'node:fs';
import { EXTENSION_LANGUAGEID } from './constants';
import { Scene, Object3D, Camera, ObjectLoader } from 'three';

type JLevel = {
	project: any;
	camera: Camera;
	scene: { object: Scene; }
	scripts: string[]
};

export class SceneOutlineProvider implements vscode.TreeDataProvider<SceneGraphActor> {
	private _onDidChangeTreeData: vscode.EventEmitter<SceneGraphActor | undefined | void> = new vscode.EventEmitter<SceneGraphActor | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<SceneGraphActor | undefined | void> = this._onDidChangeTreeData.event;
	private scene?: Scene;

	constructor(private workspaceRoot: string | undefined) {
	}

	async handleChangedSceneGraph(uri: vscode.Uri) {
		const loader = new ObjectLoader();
		const contents = fs.readFileSync(uri.fsPath, 'utf-8');
		const json = JSON.parse(contents);
		this.scene = await loader.parseAsync(json.scene) as Scene;
		this.refresh();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SceneGraphActor): vscode.TreeItem {
		return element;
	}

	getChildren(element?: SceneGraphActor): Thenable<SceneGraphActor[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		else if (!this.scene)
			return Promise.resolve([]);

		// TODO: when does this have a value??
		if (element)
			return Promise.resolve([]);
		else {
			return Promise.resolve(
				this.scene.children.map(this.getNodeAsTreeItem)
			);
		}
	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getNodeAsTreeItem(node: Object3D): SceneGraphActor {
		if (node.children?.length)
			return new SceneGraphActor(node.name, node.type, vscode.TreeItemCollapsibleState.Collapsed);

		return new SceneGraphActor(node.name,
			node.type,
			vscode.TreeItemCollapsibleState.None,
			{
				command: 'sceneOutliner.viewActorDetails',
				title: 'View Actor Details',
				arguments: [node],
			}
		);
	}
}

export class SceneGraphActor extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		private readonly type: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.type}`;
		this.description = this.type;

		const icon = {
			// 'AmbientLight': 'light',
			// 'DirectionalLight': 'light',
			// 'HemisphereLight': 'light',
			// 'PointLight': 'light',
			// 'SpotLight': 'light',

			// 'OrthographicCamera': 'camera',
			// 'PerspectiveCamera': 'camera',
		}[type] ?? 'mesh';

		// this.iconPath = {
		// 	light: path.join(__filename, '..', '..', 'resources', 'light', `${icon}.svg`),
		// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', `${icon}.svg`),
		// };
	}

	iconPath = {
		light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg')),
		dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')),
	};

	contextValue = 'dependency';
}
