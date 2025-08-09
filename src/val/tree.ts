import ValTown from "@valtown/sdk";
import * as vscode from "vscode";

export function valIcon(privacy: "public" | "private" | "unlisted") {
  switch (privacy) {
    case "public":
      return new vscode.ThemeIcon("globe");
    case "private":
      return new vscode.ThemeIcon("lock");
    case "unlisted":
      return new vscode.ThemeIcon("link");
  }
}


export class ValTreeView implements vscode.TreeDataProvider<vscode.TreeItem> {
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

  async getChildren(
    element?: (vscode.TreeItem & { val: any, file?: any })
  ) {
    if (element) {
      const files: ValTown.Vals.Files.FileRetrieveResponse[] = []
      for await (const item of this.client.vals.files.retrieve(element.val.id!, { path: element.file?.path || "", recursive: false })) {
        files.push(item)
      }

      return files.map((file) => ({
        id: file.id,
        collapsibleState: file.type === "directory" ?
          vscode.TreeItemCollapsibleState.Collapsed :
          vscode.TreeItemCollapsibleState.None,
        description: file.type !== "directory" ? file.type : undefined,
        label: file.name,
        resourceUri: vscode.Uri.parse(`vt+val://${element.val.id}/${file.path}`),
        val: element.val,
        file: file,
        contextValue: file.type === "directory" ? "val-directory" : "val-file",
        command: file.type !== "directory" ? {
          command: "vscode.open",
          title: "Open File",
          arguments: [`vt+val://${element.val.id}/${file.path}`],
        } : undefined,
      }) as vscode.TreeItem)
    }

    const vals: ValTown.Val[] = []
    for await (const res of this.client.me.vals.list({ limit: 100 })) {
      vals.push(res)
    }

    return vals.map((val) => ({
      val: val,
      label: val.name,
      description: val.author.username,
      id: val.id,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      iconPath: valIcon(val.privacy),
      contextValue: "val",
    } as vscode.TreeItem))
  }

  getTreeItem(
    element: vscode.TreeItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

export async function registerValTreeView(
  context: vscode.ExtensionContext,
  client: ValTown,
) {
  const valTree = new ValTreeView(client);
  context.subscriptions.push(
    vscode.window.createTreeView("valtown.vals", {
      treeDataProvider: valTree,
      showCollapseAll: true,
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("valtown.vals")) {
        valTree.refresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.vals.refresh", async () => {
      valTree.refresh();
    }),
    vscode.commands.registerCommand("valtown.vals.openAsWorkspace", async (arg) => {
      const { id } = arg.val
      const uri = vscode.Uri.parse(`vt+val://${id}/`);

      await vscode.commands.executeCommand(
        "vscode.openFolder",
        uri,
        { forceNewWindow: true },
      );
    })
  );
}
