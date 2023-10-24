import * as vscode from "vscode";

export async function loadToken(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration("valtown")
	const endpoint = config.get<string>("endpoint", "https://api.val.town");

	try {
		const tokens = JSON.parse(await context.secrets.get("valtown.token") || "{}") as Record<string, string>;
		return tokens[endpoint];
	} catch (e) {
		return
	}
}

export async function saveToken(context: vscode.ExtensionContext, token: string) {
	const config = vscode.workspace.getConfiguration("valtown")
	const endpoint = config.get<string>("endpoint", "https://api.val.town");

	try {
		const tokens = JSON.parse(await context.secrets.get("valtown.token") || "{}");
		tokens[endpoint] = token;
		await context.secrets.store("valtown.token", JSON.stringify(tokens));
	} catch (e) {
		const tokens = {} as Record<string, string>;
		tokens[endpoint] = token;
		await context.secrets.store("valtown.token", JSON.stringify(tokens));
	}
}

export async function clearToken(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration("valtown")
	const endpoint = config.get<string>("endpoint", "https://api.val.town");

	try {
		const tokens = JSON.parse(await context.secrets.get("valtown.token") || "{}");
		delete tokens[endpoint];
		await context.secrets.store("valtown.token", JSON.stringify(tokens));
	} catch (e) {
		return
	}
}
