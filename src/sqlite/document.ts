import * as vscode from "vscode";
import { ValtownClient } from "../client";
import { Parser } from "@json2csv/plainjs";

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
          const { columns, rows }: { columns: string[]; rows: string[][] } =
            await client.execute(query);
          const records = rows.map((row) => {
            const record: Record<string, string> = {};
            for (let i = 0; i < columns.length; i++) {
              record[columns[i]] = row[i];
            }
            return record;
          });

          return new Parser({
            fields: columns,
          }).parse(records);
        } catch (e: any) {
          return e.message;
        }
      },
    })
  );
}
