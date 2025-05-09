import { getNonce } from '../utils';
import * as vscode from 'vscode';
import getWebviewOptions from './getWebviewOptions';

const cats = {
  'Coding Cat': 'JIX9t2j0ZTN9S.webp',
  'Compiling Cat': 'mlvseq9yvZhba/giphy.gif',
  'Testing Cat': '3oriO0OEd9QIDdllqo/giphy.gif'
};

export default class SceneEditorPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: SceneEditorPanel | undefined;

  public static readonly viewType = 'catCoding';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (SceneEditorPanel.currentPanel) {
      SceneEditorPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      SceneEditorPanel.viewType,
      'Cat Coding',
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri),
    );

    SceneEditorPanel.currentPanel = new SceneEditorPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    SceneEditorPanel.currentPanel = new SceneEditorPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public doRefactor() {
    // Send a message to the webview webview.
    // You can send any JSON serializable data.
    this._panel.webview.postMessage({ command: 'refactor' });
  }

  public dispose() {
    SceneEditorPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;

    // Vary the webview's content based on where it is located in the editor.
    switch (this._panel.viewColumn) {
      case vscode.ViewColumn.Two:
        this._updateForCat(webview, 'Compiling Cat');
        return;

      case vscode.ViewColumn.Three:
        this._updateForCat(webview, 'Testing Cat');
        return;

      case vscode.ViewColumn.One:
      default:
        this._updateForCat(webview, 'Coding Cat');
        return;
    }
  }

  private _updateForCat(webview: vscode.Webview, catName: keyof typeof cats) {
    this._panel.title = catName.toString();
    const onDiskPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'scene-editor', cats[catName]);
    const catGifSrc = this._panel.webview.asWebviewUri(onDiskPath);
    this._panel.webview.html = this._getHtmlForWebview(webview, catGifSrc);
  }

  private _getHtmlForWebview(webview: vscode.Webview, catGifPath: vscode.Uri) {
    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scene-editor', 'setup.js'));
    const importmap = {
      three: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'three.module.min.js')).toString(),
      'Editor': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Editor.js')).toString(),
      'Viewport': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Viewport.js')).toString(),
      'Toolbar': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Toolbar.js')).toString(),
      'Script': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Script.js')).toString(),
      'Player': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Player.js')).toString(),
      'Sidebar': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Sidebar.js')).toString(),
      'Menubar': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Menubar.js')).toString(),
      'Resizer': webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'libs', 'js', 'Resizer.js')).toString(),
    };
    // Uri to load styles into webview
    const stylesUris = [
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'))
    ];

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scene Editor</title>

        ${stylesUris.map(uri => `<link href="${uri}" rel="stylesheet">`).join('\n        ')}
      </head>
      <body>
        <script type="importmap">{"imports": ${JSON.stringify(importmap)}}</script>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
        <script nonce="${nonce}" type="module" src="${importmap.three}"></script>
      </body>
      </html>`;
  }
}
