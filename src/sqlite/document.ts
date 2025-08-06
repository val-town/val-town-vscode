import ValTown from "@valtown/sdk";
import * as vscode from "vscode";

export function registerSqliteTextDocumentProvider(
  context: vscode.ExtensionContext,
  client: ValTown
) {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("vt+sqlite", {
      async provideTextDocumentContent(uri: vscode.Uri) {
        const queryParams = new URLSearchParams(uri.query);
        const query = queryParams.get("query");
        if (!query) {
          throw new Error("Missing query");
        }

        try {
          const res = await client.sqlite.execute({ statement: query });
          return JSON.stringify(res, null, 2);
        } catch (e: any) {
          return e.message;
        }
      },
    })
  );
}
