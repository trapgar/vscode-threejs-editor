// @ts-check

// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
	const vscode = acquireVsCodeApi();

	const root = /** @type {HTMLElement} */ (document.getElementById('root'));
	// @ts-ignore
	const editor = new THREE.Editor(root);

	// document.querySelector('.add-button')
	// 	?.querySelector('button')
	// 	?.addEventListener('click', () => {
	// 		vscode.postMessage({
	// 			type: 'add'
	// 		});
	// 	});

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
		let json;
		try {
			if (!text) {
				text = '{}';
			}
			json = JSON.parse(text);
		}
		catch {
			root.style.display = 'none';
			$error.innerHTML = `<div class="editor-placeholder-icon-container"><span class="codicon codicon-error"></span></div><div class="editor-placeholder-label-container"><span>The editor could not be opened because the file is not valid JSON.</span></div>`;
			$error.style.display = '';
			return;
		}
		root.style.display = '';
		$error.style.display = 'none';

		// TODO: tell the editor to load from json
	}

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
		}
	});

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		updateContent(state.text);
	}

	editor.scaffold();
}());
