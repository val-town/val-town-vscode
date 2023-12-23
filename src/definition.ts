import * as vscode from "vscode";
import { ValtownClient } from "./client";
export function register(
  client: ValtownClient,
  context: vscode.ExtensionContext
) {
  const urlPattern =
    /https:\/\/esm\.town\/v\/([a-zA-Z_$][0-9a-zA-Z_$]*)\/([a-zA-Z_$][0-9a-zA-Z_$]*)/g;

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      {
        scheme: "vt+val",
        language: "typescriptreact",
      },
      {
        async provideDefinition(document, position, token) {
          const range = document.getWordRangeAtPosition(position, urlPattern);
          if (!range) {
            return null;
          }

          const text = document.getText(range);
          const uri = vscode.Uri.parse(text);
          const [, author, name] = uri.path.slice(1).split("/");

          return new vscode.Location(
            vscode.Uri.parse(`vt+val:/${author}/${name}.tsx`),
            new vscode.Position(0, 0)
          );
        },
      }
    )
  );
}
