// @ts-check

// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
	const vscode = acquireVsCodeApi();

	const root = /** @type {HTMLElement} */ (document.getElementById('root'));
	// @ts-ignore
	const viewport = new THREE.Viewport(root);
	// @ts-ignore
	window.editor = viewport;

	const $error = document.createElement('div');
	document.body.appendChild($error);
	$error.className = 'monaco-editor-pane-placeholder'
	$error.style.display = 'none'
	$error.tabIndex = 0;
	$error.style.height = 'calc(100vh - 54px)';
	$error.setAttribute('aria-label', `${document.title}, The editor could not be opened because the file is not valid JSON.`);

	/**
	 * Render the document in the webview.
	 */
	function updateContent(/** @type {string} */ text) {
		if (text) {
			try {
				const json = JSON.parse(text);
				viewport.fromJson(json);
			}
			catch {
				root.style.display = 'none';
				$error.innerHTML = `<div class="editor-placeholder-icon-container"><span class="codicon codicon-error"></span></div><div class="editor-placeholder-label-container"><span>The editor could not be opened because the file is not valid JSON.</span></div>`;
				$error.style.display = '';
				return;
			}
			root.style.display = '';
			$error.style.display = 'none';
		}
		else
			viewport.scaffold();

		root.classList.remove('loading');
	}

	viewport.addEventListener('statschanged', ({ objects, vertices, triangles, frametime }) => {
		vscode.postMessage({ type: 'stats', objects, vertices, triangles, frametime });
	});

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
		switch (message.type) {
			case 'update':
				const text = message.text;

				// Update our webview's content
				updateContent(text);

				// Then persist state information.
				// This state is returned in the call to `vscode.getState` below when a webview is reloaded.
				vscode.setState({ text });

				return;
			case 'add.shape':
				const shape = message.shape;
				viewport.dispatchEvent({ type: 'add.shape', shape });
				return;
		}
	});

	console.log(`Initialized new THREE.js scene editor.`);

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		updateContent(state.text);
	}
}());
