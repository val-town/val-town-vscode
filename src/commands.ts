import * as vscode from "vscode";
import { saveToken } from "./secrets";
import { ValtownClient } from "./client";

export function registerCommands(context: vscode.ExtensionContext, client: ValtownClient) {
	function extractValID(arg: any): string {
		if (arg.id) {
			return arg.id;
		}

		if (arg.authority) {
			return arg.authority;
		}

		return ""
	}

	vscode.commands.registerCommand("valtown.setToken", async (token?: string) => {
		if (!token) {
			token = await vscode.window.showInputBox({
				prompt: "ValTown Token",
				placeHolder: "Token",
				validateInput: async (value) => {
					if (!value) {
						return "Token cannot be empty"
					}
				}
			});

			if (!token) {
				return;
			}
		}

		await saveToken(context, token);
	});

	vscode.commands.registerCommand("valtown.createVal", async () => {
		const val = await client.createVal();

		vscode.commands.executeCommand(
			"vscode.open",
			vscode.Uri.parse(
				`val://${val.id}/${val.author?.username?.slice(1)}/${val.name}/mod.ts`
			)
		);

		vscode.commands.executeCommand("valtown.refresh");
	});

	vscode.commands.registerCommand("valtown.openReadme", async (arg) => {
		const valID = extractValID(arg);
		const val = await client.getVal(valID);
		vscode.commands.executeCommand(
			"vscode.open",
			vscode.Uri.parse(
				`val://${val.id}/${val.author?.username?.slice(1)}/${val.name}/README.md`
			)
		);
	});

	vscode.commands.registerCommand("valtown.deleteVal", async (arg) => {
		const valID = extractValID(arg);
		await client.deleteVal(valID);
		await vscode.commands.executeCommand("valtown.refresh");
	});

	vscode.commands.registerCommand(
		"valtown.openInBrowser",
		async (arg) => {
			const valID = extractValID(arg);
			const val = await client.getVal(valID);
			await vscode.env.openExternal(
				vscode.Uri.parse(
					`https://val.town/v/${val.author?.username?.slice(1)}.${val.name}`,
				),
			);
		},
	);

	vscode.commands.registerCommand(
		`valtown.copyWebEndpoint`,
		async (arg) => {
			const valID = extractValID(arg);
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(
				`https://${val.author?.username?.slice(1)}-${val.name}.web.val.run`,
			);
		},
	);

	vscode.commands.registerCommand(
		`valtown.copyExpressEndpoint`,
		async (arg) => {
			const val = await client.getVal(arg);
			vscode.env.clipboard.writeText(
				`https://${val.author?.username?.slice(1)}-${val.name}.express.val.run`,
			);
		},
	);

	vscode.commands.registerCommand(
		"valtown.copyLink",
		async (arg) => {
			const val = await client.getVal(arg);
			vscode.env.clipboard.writeText(
				`https://val.town/v/${val.author?.username?.slice(1)}.${val.name}`,
			);
		},
	);

	vscode.commands.registerCommand(
		"valtown.copyEmbed",
		async (arg) => {
			const valID = extractValID(arg);
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(
				`https://val.town/embed/${val.author?.username?.slice(1)}.${val.name}`,
			);
		},
	)

	vscode.commands.registerCommand(
		"valtown.copyEmailAddress",
		async (arg) => {
			const valID = extractValID(arg);
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(`${val.author?.username?.slice(1)}.${val.name}@val.town`);
		},
	);


	vscode.commands.registerCommand(
		"valtown.openVal",
		async (arg) => {
			const valID = extractValID(arg);
			const val = await client.getVal(valID);
			return vscode.commands.executeCommand(
				"vscode.open",
				vscode.Uri.parse(
					`val://${valID}/${val.author?.username?.slice(1)}/${val.name}/mod.ts`,
				),
			);
		},
	);
}
