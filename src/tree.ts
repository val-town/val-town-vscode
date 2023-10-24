import * as vscode from "vscode";
import { BaseVal, FullVal, ValtownClient } from "./client";


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

  static valToTreeItem(val: BaseVal, prefix: string): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      val.name,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.id = `/${prefix}/${val.id}`;
    treeItem.tooltip = `${val.author?.username}/${val.name}`
    treeItem.description = `v${val.version}`;
    treeItem.iconPath = valIcon(val.privacy);
    treeItem.contextValue = "val";
    treeItem.command = {
      command: "valtown.open",
      title: "Open Val",
      arguments: [
        { id: val.id },
      ],
    };

    return treeItem;
  }

  async getChildren(
    element?: vscode.TreeItem | undefined,
  ) {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const sections = []
      if (this.pins.length > 0) {
        const pinned = new vscode.TreeItem(
          "Pinned Vals",
          this.pins.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
        )
        pinned.iconPath = new vscode.ThemeIcon("pinned");
        sections.push(pinned);
      }
      const home = new vscode.TreeItem(
        "Home Vals",
        vscode.TreeItemCollapsibleState.Expanded,
      )
      home.iconPath = new vscode.ThemeIcon("home");
      sections.push(home);
      const likes = new vscode.TreeItem(
        "Liked Vals",
        vscode.TreeItemCollapsibleState.Collapsed,
      )
      likes.iconPath = new vscode.ThemeIcon("heart");
      sections.push(likes);
      return sections;
    }

    switch (element.label) {
      case "Pinned Vals":
        return this.pins.map((val) => {
          return ValTownTreeView.valToTreeItem(val, "pins");
        });
      case "Home Vals": {
        const vals = await this.client.listMyVals()
        if (!vals) {
          return [];
        }

        return vals.map((val) => {
          return ValTownTreeView.valToTreeItem(val, "home");
        });
      }
      case "Liked Vals": {
        const vals = await this.client.listLikedVals();
        if (!vals) {
          return [];
        }

        return vals.map((val) => {
          return ValTownTreeView.valToTreeItem(val, "likes");
        })
      }
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
