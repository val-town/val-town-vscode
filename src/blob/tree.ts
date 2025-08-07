import { ValTown } from "@valtown/sdk";
import * as vscode from "vscode";

class BlobTreeView implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private client: ValTown) { }

  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(_: vscode.TreeItem | undefined) {
    const blobs = await this.client.blobs.list();

    return blobs.map((blob) => ({
      id: blob.key,
      label: blob.key,
      contextValue: "blob",
      description: blob.size ? `${blob.size / 1000} kb` : undefined,
      resourceUri: vscode.Uri.parse(`vt+blob:/${encodeURIComponent(blob.key)}`),
      iconPath: vscode.ThemeIcon.File,
      command: {
        command: "vscode.open",
        title: "Open Blob",
        arguments: [`vt+blob:/${encodeURIComponent(blob.key)}`],
      },
    }));
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

export async function registerBlobTreeView(
  context: vscode.ExtensionContext,
  client: ValTown
) {
  const tree = new BlobTreeView(client);
  context.subscriptions.push(
    vscode.window.createTreeView("valtown.blobs", {
      treeDataProvider: tree,
      showCollapseAll: true,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.blob.refresh", async () => {
      tree.refresh();
    })
  );
}
