import * as vscode from "vscode";
import { ValtownClient } from "./client";

export function registerUriHandler(
  context: vscode.ExtensionContext,
  client: ValtownClient,
) {
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri) {
        const parts = uri.path.slice(1).split("/");
        if (parts.length !== 3 || parts[0] !== "v") {
          vscode.window.showErrorMessage(
            `Invalid valtown URI: ${uri.toString()}`,
          );
          return;
        }

        const [_, author, name] = parts;
        const val = await client.resolveValAlias(author, name);
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse(`vt+val:/${author}/${name}.tsx`),
        );
      },
    }),
  );
}
