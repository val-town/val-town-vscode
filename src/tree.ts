import * as vscode from "vscode";
import { FullVal, ValtownClient } from "./client";

export async function registerTreeView(context: vscode.ExtensionContext, client: ValtownClient) {
  const tree = new ValTownTreeView(client);
  const pins = await context.globalState.get<Record<string, FullVal>>("valtown.pins", {});
  tree.pins = Object.values(pins);
  context.subscriptions.push(vscode.window.createTreeView("valtown", {
    treeDataProvider: tree,
    showCollapseAll: true,
  }))

  context.subscriptions.push(vscode.commands.registerCommand("valtown.refresh", async () => {
    const pins = await context.globalState.get<Record<string, FullVal>>("valtown.pins", {});
    tree.pins = Object.values(pins);
    tree.refresh();
  }))

}

function valIcon(privacy: "public" | "private" | "unlisted") {
  switch (privacy) {
    case "public":
      return new vscode.ThemeIcon("globe");
    case "private":
      return new vscode.ThemeIcon("lock");
    case "unlisted":
      return new vscode.ThemeIcon("link");
  }
}

export class ValTownTreeView
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private client: ValtownClient) {
  }

  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  public pins: FullVal[] = [];

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getChildren(
    element?: vscode.TreeItem | undefined,
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const pinned = new vscode.TreeItem(
        "Pinned Vals",
        this.pins.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
      )
      pinned.iconPath = new vscode.ThemeIcon("pinned");
      const home = new vscode.TreeItem(
        "Home Vals",
        vscode.TreeItemCollapsibleState.Expanded,
      )
      home.iconPath = new vscode.ThemeIcon("home");
      const likes = new vscode.TreeItem(
        "Liked Vals",
        vscode.TreeItemCollapsibleState.Collapsed,
      )
      likes.iconPath = new vscode.ThemeIcon("heart");
      return [
        pinned,
        home,
        likes,
      ];
    }

    switch (element.label) {
      case "Pinned Vals":
        return Object.values(this.pins).map((val) => {
          const treeItem = new vscode.TreeItem(
            `${val.author.username}/${val.name}`,
            vscode.TreeItemCollapsibleState.None,
          );
          treeItem.id = `/pins/${val.id}`;
          treeItem.description = `v${val.version}`;
          treeItem.iconPath = valIcon(val.privacy);
          treeItem.contextValue = "val";
          treeItem.command = {
            command: "valtown.openVal",
            title: "Open Val",
            arguments: [
              { id: val.id },
            ],
          };

          return treeItem;
        });
      case "Home Vals":
        return this.client.listMyVals().then((vals) => {
          if (!vals) {
            return [];
          }

          return vals.map((val) => {
            const treeItem = new vscode.TreeItem(
              `${val.name}`,
              vscode.TreeItemCollapsibleState.None,
            );
            treeItem.id = `/home/${val.id}`;
            treeItem.description = `v${val.version}`;
            treeItem.iconPath = valIcon(val.privacy);
            treeItem.contextValue = "val";
            treeItem.command = {
              command: "valtown.openVal",
              title: "Open Val",
              arguments: [
                { id: val.id },
              ],
            };

            return treeItem;
          });
        });

      case "Liked Vals":
        return this.client.listLikedVals().then((vals) => {
          if (!vals) {
            return [];
          }

          return vals.map((val) => {
            const treeItem = new vscode.TreeItem(
              `${val.author.username}/${val.name}`,
              vscode.TreeItemCollapsibleState.None,
            );
            treeItem.id = `/likes/${val.id}`;
            treeItem.description = `v${val.version}`;
            treeItem.iconPath = valIcon(val.privacy);
            treeItem.contextValue = "val";
            treeItem.command = {
              command: "valtown.openVal",
              title: "Open Val",
              arguments: [
                { id: val.id },
              ],
            };

            return treeItem;
          });
        });
      default:
        return [];
    }
  }

  getTreeItem(
    element: vscode.TreeItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}
