import * as vscode from "vscode";
import { ValtownClient } from "../client";

export function register(
  context: vscode.ExtensionContext,
  client: ValtownClient
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
          const res = await client.execute(query);
          return JSON.stringify(res, null, 2);
        } catch (e: any) {
          return e.message;
        }
      },
    })
  );
}
