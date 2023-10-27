import * as vscode from "vscode";
import { BaseVal, FullVal, ValtownClient } from "./client";
import { sortFunctions } from "./sortUtils";

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
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  constructor(
    private context: vscode.ExtensionContext,
    private client: ValtownClient
  ) {
    this.context = context;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  public pins: FullVal[] = [];

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  static valToTreeItem(val: BaseVal, prefix: string): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      val.name,
      vscode.TreeItemCollapsibleState.None
    );
    treeItem.id = `/${prefix}/${val.id}`;
    treeItem.tooltip = `${val.author?.username}/${val.name}`;
    treeItem.description = `v${val.version}`;
    treeItem.iconPath = valIcon(val.privacy);
    treeItem.contextValue = "val";
    treeItem.command = {
      command: "valtown.open",
      title: "Open Val",
      arguments: [{ id: val.id }],
    };

    return treeItem;
  }

  async getChildren(element?: vscode.TreeItem | undefined) {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const sections = [];

      if (this.pins.length > 0) {
        const pinned = new vscode.TreeItem(
          "Pinned Vals",
          this.pins.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None
        );
        pinned.contextValue = "pinned";
        pinned.iconPath = new vscode.ThemeIcon("pinned");
        sections.push(pinned);
      }

      const home = new vscode.TreeItem(
        "Home Vals",
        vscode.TreeItemCollapsibleState.Expanded
      );
      home.contextValue = "home";
      home.iconPath = new vscode.ThemeIcon("home");
      sections.push(home);
      const likes = new vscode.TreeItem(
        "Liked Vals",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      likes.contextValue = "likes";
      likes.iconPath = new vscode.ThemeIcon("heart");
      sections.push(likes);

      return sections;
    }

    switch (element.label) {
      case "Pinned Vals": {
        const pinsSortOrder: string | undefined =
          this.context.workspaceState.get("pinnedSortState");

        if (pinsSortOrder !== undefined) {
          const sortFunction = sortFunctions[pinsSortOrder];

          if (sortFunction !== undefined) {
            return this.pins
              .sort(sortFunction)
              .map((val) => ValTownTreeView.valToTreeItem(val, "pins"));
          }
        }

        return this.pins.map((val) =>
          ValTownTreeView.valToTreeItem(val, "pins")
        );

        // return this.pins.map((val) => {
        //   return ValTownTreeView.valToTreeItem(val, "pins");
        // });
      }
      case "Home Vals": {
        const vals = await this.client.listMyVals();
        if (!vals) {
          return [];
        }

        const homeSortOrder: string | undefined =
          this.context.workspaceState.get("homeSortState");
        if (homeSortOrder !== undefined) {
          const sortFunction = sortFunctions[homeSortOrder];

          if (sortFunction !== undefined) {
            return vals
              .sort(sortFunction)
              .map((val) => ValTownTreeView.valToTreeItem(val, "home"));
          }
        }

        return vals.map((val) => ValTownTreeView.valToTreeItem(val, "home"));
      }
      case "Liked Vals": {
        const vals = await this.client.listLikedVals();
        if (!vals) {
          return [];
        }

        const likesSortOrder: string | undefined =
          this.context.workspaceState.get("likedSortState");
        if (likesSortOrder !== undefined) {
          const sortFunction = sortFunctions[likesSortOrder];

          if (sortFunction !== undefined) {
            return vals
              .sort(sortFunction)
              .map((val) => ValTownTreeView.valToTreeItem(val, "home"));
          }
        }

        return vals.map((val) => ValTownTreeView.valToTreeItem(val, "home"));
      }
      default:
        return [];
    }
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

export async function registerTreeView(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  context.workspaceState.update("homeSortState", undefined);
  context.workspaceState.update("pinnedSortState", undefined);
  context.workspaceState.update("likedSortState", undefined);

  const tree = new ValTownTreeView(context, client);
  const pins = await context.globalState.get<Record<string, FullVal>>(
    "valtown.pins",
    {}
  );
  tree.pins = Object.values(pins);

  context.subscriptions.push(
    vscode.window.createTreeView("valtown", {
      treeDataProvider: tree,
      showCollapseAll: true,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.refresh", async () => {
      const pins = await context.globalState.get<Record<string, FullVal>>(
        "valtown.pins",
        {}
      );
      tree.pins = Object.values(pins);
      tree.refresh();
    })
  );
}
