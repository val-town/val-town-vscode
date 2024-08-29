import * as vscode from "vscode";
import { ValtownClient } from "./client";

enum ValImportKind {
  Default,
  Named,
  SideEffect,
}

export function registerCompletions(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "vt+val", language: "typescriptreact" },
      {
        async provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          // see if we can match backwards from the cursor to find @[<handle>[/<val>]]
          const atImportMatch = /@([a-zA-Z0-9]*)(?:\/([a-zA-Z0-9_]*))?$/.exec(
            document.getText(
              new vscode.Range(
                position.line,
                0,
                position.line,
                position.character
              )
            )
          );

          // if we can't match, don't provide any completions
          if (!atImportMatch) {
            return [];
          }

          const [atImport, typedHandle, name] = atImportMatch;
          const startOfAtImport = position.translate(0, -atImport.length);

          // get completions from the API
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
              let importKind: ValImportKind = ValImportKind.SideEffect;
              if (exportedName === "default") {
                importKind = ValImportKind.Default;
              } else if (exportedName) {
                importKind = ValImportKind.Named;
              }

              const snippetCompletion = new vscode.CompletionItem({
                label: `@${typedHandle === "me" ? "me" : handle}/${name}`,
                detail: ` ${exportedName ?? "(no export)"}`,
                description: `v${version}`,
              });
              snippetCompletion.documentation = new vscode.MarkdownString(
                "```tsx\n" + code + "\n```"
              );
              let insertText = "";
              if (importKind === ValImportKind.Default) {
                insertText = name;
              } else if (importKind === ValImportKind.Named) {
                insertText = exportedName;
              }
              snippetCompletion.insertText = insertText;
              snippetCompletion.range = new vscode.Range(
                startOfAtImport,
                position
              );
              // might not be a function, but we can't tell
              snippetCompletion.kind = vscode.CompletionItemKind.Function;
              snippetCompletion.command = {
                title: "Import Val",
                command: "valtown.importVal",
                arguments: [
                  handle,
                  name,
                  exportedName,
                  version,
                  // this is the range of the replaced text
                  new vscode.Range(
                    startOfAtImport,
                    startOfAtImport.translate(insertText.length)
                  ),
                ],
              };
              return snippetCompletion;
            }
          );
        },
      }
      // "@", "/"
    )
  );
}
