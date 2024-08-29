import * as vscode from "vscode";
import * as ts from "typescript";
import { ValtownClient } from "./client";

export function registerCompletions(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  // Register the autocomplete provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "vt+val", language: "typescriptreact" },
      {
        async provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          const line = document.lineAt(position);
          const text = line.text.slice(0, position.character);
          const match = /@([a-zA-Z0-9]*)(?:\/([a-zA-Z0-9_]*))?$/.exec(text);

          if (!match) {
            return [];
          }

          const [full, typedHandle, name] = match;

          const data = await client.autocomplete(typedHandle, name);

          return data.map(
            ({
              handle,
              name,
              // author,
              // createdAt,
              code,
              version,
              exportedName,
            }) => {
              const snippetCompletion = new vscode.CompletionItem({
                label: `@${typedHandle}/${name}`,
                detail:
                  exportedName !== "default"
                    ? ` ${exportedName ?? "(no export)"}`
                    : undefined,
                description: `v${version}`,
              });
              snippetCompletion.documentation = new vscode.MarkdownString(
                "```tsx\n" + code + "\n```"
              );
              snippetCompletion.documentation.baseUri = vscode.Uri.parse(
                "http://example.com/a/b/c/"
              );
              const insertText =
                exportedName === "default" ? name : exportedName ?? "";
              snippetCompletion.insertText = insertText;
              snippetCompletion.range = new vscode.Range(
                position.translate(0, -full.length),
                position
              );
              snippetCompletion.kind = vscode.CompletionItemKind.Function;
              snippetCompletion.command = {
                title: "Import Val",
                command: "valtown.importVal",
                arguments: [
                  handle,
                  name,
                  exportedName,
                  version,
                  new vscode.Range(
                    position.translate(0, -full.length),
                    position.translate(0, -full.length + insertText.length)
                  ),
                ],
              };
              return snippetCompletion;
            }
          );
        },
      }
      // "@",
      // "/"
    )
  );
}
