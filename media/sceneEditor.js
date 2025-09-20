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

	viewport.configure({
		translationSnap: 0.5,
		rotationSnap: 0.5,
		scaleSnap: 0.5,
	});

	const $error = document.createElement('div');
	document.body.appendChild($error);
	$error.className = 'monaco-editor-pane-placeholder'
	$error.style.display = 'none'
	$error.tabIndex = 0;
	$error.style.height = 'calc(100vh - 54px)';
	$error.setAttribute('aria-label', `${document.title}, The editor could not be opened because the file is not valid JSON.`);

	/** @type {{ current?: string; }} */
	const sha = { current: undefined };

	/** Render the document in the webview. */
	async function updateContent(/** @type {string} */ text) {
		if (text) {
			try {
				const json = JSON.parse(text);
				const newSha = await ahash(JSON.stringify(json)).then(r => r.substring(0, 8));

				// Only update the scene if it's actually changed
				if (!sha.current || sha.current !== newSha) {
					sha.current = newSha;
					viewport.fromJson(json);
				}

				root.style.display = '';
				$error.style.display = 'none';
			}
			catch {
				root.style.display = 'none';
				$error.innerHTML = `<div class="editor-placeholder-icon-container"><span class="codicon codicon-error"></span></div><div class="editor-placeholder-label-container"><span>The editor could not be opened because the file is not valid JSON.</span></div>`;
				$error.style.display = '';
			}
		}
		else
			viewport.scaffold();

		root.classList.remove('loading');
	}

	/** Asynchronously creates a SHA-256 hash from the given string. */
	async function ahash(/** @type {string} */ text) {
		const encoder = new TextEncoder();
		const data = encoder.encode(text);
		const buffer = await crypto.subtle.digest('SHA-256', data);

		return Array.from(new Uint8Array(buffer))
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	viewport.addEventListener('statschanged', ({ objects, vertices, triangles, frametime }) => {
		vscode.postMessage({ type: 'stats', objects, vertices, triangles, frametime });
	});
	viewport.addEventListener('scenegraphchanged', async () => {
		const state = await viewport.toJson();
		const newSha = await ahash(JSON.stringify(state)).then(r => r.substring(0, 8));

		// webview & text document are out of sync
		if (sha.current !== newSha) {
			sha.current = newSha;
			vscode.postMessage({ type: 'scenegraphchanged', state });
		}
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
			default:
				viewport.dispatchEvent({ ...message });
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
