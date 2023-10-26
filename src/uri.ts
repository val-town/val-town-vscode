import * as vscode from "vscode";

class ValtownUriHandler implements vscode.UriHandler {
	public async handleUri(uri: vscode.Uri) {
		const params = new URLSearchParams(uri.query);
		switch (uri.path) {
			case "/open":
				const valID = params.get("val");
				vscode.commands.executeCommand("valtown.open", valID);
				break;
			default:
				vscode.window.showErrorMessage(`Unknown valtown uri: ${uri.toString()}`);
		}
	}
}

export function registerUriHandler(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.window.registerUriHandler(new ValtownUriHandler()))
}
