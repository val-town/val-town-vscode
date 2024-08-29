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

  // TODO: refactor this into "additional edits"
  // Register the command to handle the function import
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "valtown.importVal",
      async (
        handle: string,
        name: string,
        exportedName: string,
        version: string,
        keywordRange: vscode.Range
      ) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        const document = editor.document;

        const importURL = `https://esm.town/v/${handle}/${name}`; // TODO: enable versioning as option?
        const text = document.getText();
        const sourceFile = ts.createSourceFile(
          document.fileName,
          text,
          ts.ScriptTarget.ES2015,
          true
        );

        let result: {
          statement: string;
          range: vscode.Range;
          keyword: string;
        } | null = null;
        let lastStaticImportEnd: number | null = null;

        function toVSCodePosition(startOrEnd: number): vscode.Position {
          const position = sourceFile.getLineAndCharacterOfPosition(startOrEnd);
          return new vscode.Position(position.line, position.character);
        }

        function toVSCodeRange(node: ts.Node): vscode.Range {
          const start = toVSCodePosition(node.getStart());
          const end = toVSCodePosition(node.getEnd());

          return new vscode.Range(start, end);
        }

        function visit(node: ts.Node) {
          if (result !== null) {
            return;
          }

          if (!ts.isImportDeclaration(node)) {
            return;
          }

          const moduleSpecifier = node.moduleSpecifier
            .getText(sourceFile)
            .replace(/['"]/g, "");

          if (moduleSpecifier !== importURL) {
            lastStaticImportEnd = node.getEnd();
            return;
          }

          const importClause = node.importClause;
          const defaultImport = importClause?.name;
          const namedImports = importClause?.namedBindings as
            | ts.NamedImports
            | undefined;

          const matchingNamedImport = namedImports?.elements.find(
            (e) => (e.propertyName ?? e.name).getText() === exportedName
          );

          // case 1: import has what we need, do nothing
          if (
            exportedName === null ||
            (defaultImport !== undefined && exportedName === "default") ||
            matchingNamedImport
          ) {
            result = {
              statement: node.getText(),
              range: toVSCodeRange(node),
              keyword:
                exportedName === "default"
                  ? defaultImport!.getText()
                  : matchingNamedImport!.name.getText(),
            };
            return;
          }

          // case 2: we need to add the default import
          if (exportedName === "default") {
            let statement = `import ${name}`;
            if (namedImports) {
              statement += `, ${namedImports.getText()}`;
            }
            statement += ` from '${importURL}';`;
            result = {
              statement,
              range: toVSCodeRange(node),
              keyword: name,
            };
            return;
          }

          // case 3: we need to add the named import
          let statement = "import ";
          if (defaultImport) {
            statement += `${defaultImport.getText()}, `;
          }
          statement += "{ ";
          if (namedImports) {
            statement +=
              namedImports.elements.map((e) => e.getText()).join(", ") + ", ";
          }
          statement += `${exportedName} } from '${importURL}';`;

          result = {
            statement,
            range: toVSCodeRange(node),
            keyword: exportedName,
          };
        }

        ts.forEachChild(sourceFile, visit);

        if (result === null) {
          let nextLine;
          if (lastStaticImportEnd !== null) {
            nextLine = new vscode.Position(
              sourceFile.getLineAndCharacterOfPosition(lastStaticImportEnd)
                .line + 1,
              0
            );
          } else {
            nextLine = new vscode.Position(0, 0);
          }
          let statement = "import ";
          if (exportedName === "default") {
            statement += `${name} from `;
          } else if (exportedName !== null) {
            statement += `{ ${exportedName} } from `;
          }
          statement += `'${importURL}';\n`;
          result = {
            statement,
            range: new vscode.Range(nextLine, nextLine),
            keyword: exportedName === "default" ? name : exportedName,
          };
        }
        editor.edit(
          (editBuilder) => {
            if (result === null) {
              return;
            }
            editBuilder.replace(result.range, result.statement);
            editBuilder.replace(keywordRange, result.keyword);
          },
          { undoStopBefore: false, undoStopAfter: true }
        );
        // TODO: should we handle case that named export is name of default export?
        // TODO: are we hammering the API? should we try to debounce or throttle?
      }
    )
  );
}
