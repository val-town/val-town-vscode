import * as vscode from "vscode";
import { ValtownClient } from "../client";

function columnIcon(type: string) {
  switch (type.toLowerCase()) {
    case "integer":
    case "real":
      return new vscode.ThemeIcon("symbol-number");
    case "text":
      return new vscode.ThemeIcon("symbol-string");
    case "blob":
      return new vscode.ThemeIcon("symbol-array");
    case "null":
      return new vscode.ThemeIcon("symbol-null");
    default:
      return new vscode.ThemeIcon("symbol-variable");
  }
}

export class SqliteTreeView
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  constructor(private client: ValtownClient) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element: vscode.TreeItem | undefined) {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const { rows }: { rows: string[][] } = await this.client.execute(
        `SELECT name FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%';`
      );

      return rows.map(([table]) => ({
        id: table,
        label: table,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        iconPath: new vscode.ThemeIcon("list-unordered"),
        contextValue: "table",
      }));
    }

    const { rows }: { rows: string[][] } = await this.client.execute(
      `PRAGMA table_info(${element.label});`
    );

    return rows.map(([_, name, type]) => ({
      id: `${element.label}.${name}`,
      label: name,
      description: type.toLowerCase(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      iconPath: columnIcon(type),
      contextValue: "column",
    }));
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

export async function registerSqliteTreeView(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  const tree = new SqliteTreeView(client);
  context.subscriptions.push(
    vscode.window.createTreeView("valtown.sqlite", {
      treeDataProvider: tree,
      showCollapseAll: true,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.sqlite.refresh", async () => {
      tree.refresh();
    }),
    vscode.commands.registerCommand("valtown.sqlite.copyTableName", (node) => {
      vscode.env.clipboard.writeText(node.label);
    }),
    vscode.commands.registerCommand("valtown.sqlite.copyColumnName", (node) => {
      vscode.env.clipboard.writeText(node.label);
    }),
    vscode.commands.registerCommand("valtown.sqlite.newQuery", async () => {
      // create a new untitled document
      let doc = await vscode.workspace.openTextDocument({
        language: "sql",
        content: "",
      });
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("valtown.sqlite.runQuery", async (arg) => {
      const document = await vscode.workspace.openTextDocument(arg);
      const query = document.getText();

      const uri = vscode.Uri.parse(
        `vt+sqlite:/results.csv?query=${encodeURIComponent(query)}`
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    }),
    vscode.commands.registerCommand(
      "valtown.sqlite.previewTable",
      async (node) => {
        const table = node.label;
        const query = `SELECT * FROM ${table} LIMIT 1000;`;
        const uri = vscode.Uri.parse(
          `vt+sqlite:/${table}.csv?query=${encodeURIComponent(query)}`
        );

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
      }
    )
  );
}
