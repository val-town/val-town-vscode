import * as vscode from "vscode";
import { clearToken, saveToken } from "./secrets";
import { FullVal, ValtownClient } from "./client";
import { valIcon } from "./tree";

export function registerCommands(context: vscode.ExtensionContext, client: ValtownClient) {
	function extractValID(arg: any) {
		if (arg.id) {
			return arg.id.split("/").pop() as string;
		}

		if (arg.authority) {
			return arg.authority as string;
		}

		throw new Error("Could not extract val ID");
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

	vscode.commands.registerCommand("valtown.clearToken", async () => {
		await clearToken(context);
	});

	vscode.commands.registerCommand("valtown.createVal", async () => {
		const val = await client.createVal();

		vscode.commands.executeCommand(
			"vscode.open",
			vscode.Uri.parse(
				`val://${val.id}/${val.author?.username?.slice(1)}/${val.name}/mod.tsx`
			)
		);

		vscode.commands.executeCommand("valtown.refresh");
	});

	vscode.commands.registerCommand("valtown.copyAsJSON", async (arg) => {
		let valID: string
		if (arg) {
			valID = extractValID(arg);
		} else {
			if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
				return
			}
			valID = vscode.window.activeTextEditor?.document.uri.authority
		}

		const val = await client.getVal(valID);
		vscode.env.clipboard.writeText(JSON.stringify(val, null, 2));
	});

	vscode.commands.registerCommand("valtown.copyImport", async (arg) => {
		let valID: string
		if (arg) {
			valID = extractValID(arg);
		} else {
			if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
				return
			}
			valID = vscode.window.activeTextEditor?.document.uri.authority
		}

		const val = await client.getVal(valID);
		vscode.env.clipboard.writeText(`import { ${val.name} } from "https://esm.town/v/${val.author.username.slice(1)}/${val.name}"`);
		vscode.window.showInformationMessage(`Import statement copied to clipboard`);
	})

	vscode.commands.registerCommand("valtown.copyID", async (arg) => {
		let valID: string
		if (arg) {
			valID = extractValID(arg);
		} else {
			if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
				return
			}
			valID = vscode.window.activeTextEditor?.document.uri.authority
		}

		vscode.env.clipboard.writeText(valID);
		vscode.window.showInformationMessage(`Val ID copied to clipboard`);
	});

	vscode.commands.registerCommand("valtown.copyRunEndpoint", async (arg) => {
		let valID: string
		if (arg) {
			valID = extractValID(arg);
		} else {
			if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
				return
			}
			valID = vscode.window.activeTextEditor?.document.uri.authority
		}

		const val = await client.getVal(valID);
		vscode.env.clipboard.writeText(`https://api.val.town/v1/run/${val.author?.username?.slice(1)}.${val.name}`);
		vscode.window.showInformationMessage(`Val run endpoint copied to clipboard`);
	})

	vscode.commands.registerCommand("valtown.deleteVal", async (arg) => {
		let valID: string
		if (arg) {
			valID = extractValID(arg);
		} else {
			if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
				return
			}
			valID = vscode.window.activeTextEditor?.document.uri.authority
		}

		await client.deleteVal(valID);
		await vscode.commands.executeCommand("valtown.refresh");
	});

	vscode.commands.registerCommand(
		"valtown.openInBrowser",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			await vscode.env.openExternal(
				vscode.Uri.parse(
					`https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`,
				),
			);
		},
	);

	vscode.commands.registerCommand(
		`valtown.copyWebEndpoint`,
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(
				`https://${val.author?.username?.slice(1)}-${val.name}.web.val.run`,
			);
			vscode.window.showInformationMessage(`Val web endpoint copied to clipboard`);
		},
	);

	vscode.commands.registerCommand(
		`valtown.copyExpressEndpoint`,
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			await vscode.env.clipboard.writeText(
				`https://${val.author?.username?.slice(1)}-${val.name}.express.val.run`,
			);
			vscode.window.showInformationMessage(`Val express endpoint copied to clipboard`);
		},
	);

	vscode.commands.registerCommand(
		"valtown.copyLink",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(
				`https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`,
			);
			vscode.window.showInformationMessage(`Val link copied to clipboard`);
		},
	);

	vscode.commands.registerCommand(
		"valtown.openLogs",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			await vscode.env.openExternal(
				vscode.Uri.parse(
					`https://val.town/v/${val.author?.username?.slice(1)}/${val.name}/evaluations`,
				),
			);
		})

	vscode.commands.registerCommand(
		"valtown.copyEmbed",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			vscode.env.clipboard.writeText(
				`https://val.town/embed/${val.author?.username?.slice(1)}.${val.name}`,
			);
			vscode.window.showInformationMessage(`Val embed link copied to clipboard`);
		},
	)

	vscode.commands.registerCommand(
		"valtown.togglePinned",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			const pinnedVals = context.globalState.get<Record<string, FullVal>>("valtown.pins", {});
			if (pinnedVals[valID]) {
				delete pinnedVals[valID];
			} else {
				pinnedVals[valID] = val;
			}
			await context.globalState.update("valtown.pins", pinnedVals);
			await vscode.commands.executeCommand("valtown.refresh");
		},
	)

	vscode.commands.registerCommand(
		"valtown.copyEmailAddress",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
					return
				}
				valID = vscode.window.activeTextEditor?.document.uri.authority
			}
			const val = await client.getVal(valID);
			await vscode.env.clipboard.writeText(`${val.author?.username?.slice(1)}.${val.name}@val.town`);
			vscode.window.showInformationMessage(`Val email address copied to clipboard`);
		},
	);


	vscode.commands.registerCommand(
		"valtown.open",
		async (arg) => {
			let valID: string
			if (arg) {
				valID = extractValID(arg);
			} else {
				const vals = await client.listMyVals();
				const pick = await vscode.window.showQuickPick<{ id: string } & vscode.QuickPickItem>(
					vals.map(val => ({
						id: val.id,
						label: `\$(${valIcon(val.privacy).id}) ${val.name}`,
						description: `v${val.version}`
					})), { title: "Select a val to open" })
				if (!pick) {
					return
				}

				valID = pick.id;
			}

			const val = await client.getVal(valID);
			return vscode.commands.executeCommand(
				"vscode.open",
				vscode.Uri.parse(
					`val://${valID}/${val.author?.username?.slice(1)}/${val.name}/mod.tsx`,
				),
			);
		},
	);
}
