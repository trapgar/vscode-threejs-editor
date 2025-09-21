import * as path from 'path';
import { Object3D, ObjectLoader, Vector3 } from 'three';
import * as vscode from 'vscode';

export class ActorOutlineProvider implements vscode.TreeDataProvider<ActorFieldValue> {
  private _onDidChangeTreeData: vscode.EventEmitter<ActorFieldValue | undefined | void> = new vscode.EventEmitter<ActorFieldValue | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ActorFieldValue | undefined | void> = this._onDidChangeTreeData.event;
  private actor?: Object3D;

  constructor(private workspaceRoot: string | undefined) {
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async handleChangedActor(newActor?: any) {
    const loader = new ObjectLoader();
    this.actor = await loader.parseAsync({ object: newActor });
    this.refresh();
  }

  getTreeItem(element: ActorFieldValue): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ActorFieldValue): Thenable<ActorFieldValue[]> {
    if (!this.actor)
      return Promise.resolve([]);

    // TODO: when does this have a value??
    if (element)
      return Promise.resolve([]);
    else {
      return Promise.resolve([
        new ActorFieldValue('Type', 'string', this.actor.type, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('UUID', 'string', this.actor.uuid, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Name', 'string', this.actor.name, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Position', 'vector3', `(${[this.actor.position.x, this.actor.position.y, this.actor.position.z].join(', ')})`, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Rotation', 'vector3', `(${[this.actor.rotation.x, this.actor.rotation.y, this.actor.rotation.z].join(', ')})`, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Scale', 'vector3', `(${[this.actor.scale.x, this.actor.scale.y, this.actor.scale.z].join(', ')})`, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Shadow', 'string', undefined, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Visible', 'boolean', this.actor.visible ? '✔' : '❌', vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Frustum Cull', 'boolean', this.actor.frustumCulled ? '✔' : '❌', vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('Render Order', 'number', `${this.actor.renderOrder ?? 0}`, vscode.TreeItemCollapsibleState.None),
        new ActorFieldValue('User Data', 'custom', undefined, vscode.TreeItemCollapsibleState.None),
      ]);
    }
  }
}

export class ActorFieldValue extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: 'boolean' | 'number' | 'string' | 'vector3' | 'custom',
    public readonly value: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);

    this.tooltip = `${this.label}`;
    this.description = value;
    // this.iconPath = {
    //   'boolean': { light: path.join(__filename, '..', '..', 'resources', 'light', 'boolean.svg'), dark: path.join(__filename, '..', '..', 'resources', 'dark', 'boolean.svg') },
    //   'number': { light: path.join(__filename, '..', '..', 'resources', 'light', 'number.svg'), dark: path.join(__filename, '..', '..', 'resources', 'dark', 'number.svg') },
    //   'string': new vscode.ThemeIcon('quote'),
    //   'vector3': { light: path.join(__filename, '..', '..', 'resources', 'light', 'vector3.svg'), dark: path.join(__filename, '..', '..', 'resources', 'dark', 'vector3.svg') },
    //   'custom': new vscode.ThemeIcon('json'),
    // }[type] as any;
  }

  iconPath = {
    light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg')),
    dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')),
  };

  contextValue = 'dependency';
}
