import * as vscode from "vscode";
import { clearToken, loadToken } from "./secrets";

export function registerCommands(
  context: vscode.ExtensionContext,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.copyToken", async () => {
      const token = await loadToken(context);
      if (token) {
        await vscode.env.clipboard.writeText(token);
        vscode.window.showInformationMessage("Token copied to clipboard");
      } else {
        vscode.window.showErrorMessage("No token found");
      }
    }),
    vscode.commands.registerCommand("valtown.clearToken", async () => {
      await clearToken(context);
    }),
    vscode.commands.registerCommand("valtown.copyValID", async (arg) => {
      vscode.env.clipboard.writeText(arg.val.id);
      vscode.window.showInformationMessage(`Val ID copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.copyValUrl", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.clipboard.writeText(
        `https://val.town/x/${author.username}/${name}`,
      );
      vscode.window.showInformationMessage(`Val link copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openValUrl", async (arg) => {
      let valUrl: string;
      if ("val" in arg) {
        const { author, name } = arg.val;
        valUrl = `https://val.town/x/${author.username}/${name}`;
      } else {
        const [author, filename] = arg.path.slice(1).split("/");
        valUrl = `https://val.town/x/${author}/${filename.split(".")[0]}`;
      }

      await vscode.env.openExternal(vscode.Uri.parse(valUrl));
    }),
  );
}

