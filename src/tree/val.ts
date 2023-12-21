import * as vscode from "vscode";
import { BaseVal, FullVal, ValPrivacy, ValtownClient } from "../client";

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
  constructor(private client: ValtownClient) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  public pins: FullVal[] = [];
  public filters: Record<ValPrivacy, boolean> = {
    public: true,
    private: true,
    unlisted: true,
  };

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
      command: "vscode.open",
      title: "Open Val",
      arguments: [`vt+val://${val.id}/${val.name}.tsx`],
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
        pinned.iconPath = new vscode.ThemeIcon("pinned");
        sections.push(pinned);
      }
      const home = new vscode.TreeItem(
        "Home Vals",
        vscode.TreeItemCollapsibleState.Expanded
      );
      home.iconPath = new vscode.ThemeIcon("home");
      sections.push(home);
      const likes = new vscode.TreeItem(
        "Liked Vals",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      likes.iconPath = new vscode.ThemeIcon("heart");
      sections.push(likes);
      return sections;
    }

    switch (element.label) {
      case "Pinned Vals":
        return this.pins
          .filter((val) => this.filters[val.privacy])
          .map((val) => {
            return ValTreeView.valToTreeItem(val, "pins");
          });
      case "Home Vals": {
        const vals = await this.client.listMyVals();
        if (!vals) {
          return [];
        }

        return vals
          .filter((val) => this.filters[val.privacy])
          .map((val) => {
            return ValTreeView.valToTreeItem(val, "home");
          });
      }
      case "Liked Vals": {
        const vals = await this.client.listLikedVals();

        if (!vals) {
          return [];
        }

        return vals
          .filter((val) => this.filters[val.privacy])
          .map((val) => {
            return ValTreeView.valToTreeItem(val, "likes");
          });
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

export async function registerValTreeView(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  const tree = new ValTreeView(client);
  const pins = await context.globalState.get<Record<string, FullVal>>(
    "valtown.pins",
    {}
  );
  const filters = context.globalState.get<Record<ValPrivacy, boolean>>(
    "valtown.filters",
    {
      public: true,
      private: true,
      unlisted: true,
    }
  );
  tree.filters = filters;
  tree.pins = Object.values(pins);
  context.subscriptions.push(
    vscode.window.createTreeView("valtown.vals", {
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
    }),
    vscode.commands.registerCommand("valtown.togglePinned", async (arg) => {
      if (!arg.id) {
        vscode.window.showErrorMessage("No val selected");
        return;
      }
      const valID = arg.id.split("/").pop() as string;
      const val = await client.getVal(valID);
      const pinnedVals = context.globalState.get<Record<string, FullVal>>(
        "valtown.pins",
        {}
      );
      if (pinnedVals[valID]) {
        delete pinnedVals[valID];
      } else {
        pinnedVals[valID] = val;
      }
      await context.globalState.update("valtown.pins", pinnedVals);

      tree.pins = Object.values(pinnedVals);
      await tree.refresh();
    }),
    vscode.commands.registerCommand("valtown.val.setFilters", async () => {
      const filters = context.globalState.get<Record<ValPrivacy, boolean>>(
        "valtown.filters",
        {
          public: true,
          private: true,
          unlisted: true,
        }
      );
      const picks = await vscode.window.showQuickPick<
        vscode.QuickPickItem & { privacy: ValPrivacy }
      >(
        [
          {
            label: "Private",
            description: "Show private vals",
            picked: filters.private,
            privacy: "private",
          },
          {
            label: "Unlisted",
            description: "Show unlisted vals",
            picked: filters.unlisted,
            privacy: "unlisted",
          },
          {
            label: "Public",
            description: "Show public vals",
            picked: filters.public,
            privacy: "public",
          },
        ],
        {
          title: "Filter Vals",
          canPickMany: true,
        }
      );

      if (!picks) {
        return;
      }

      const newFilters = {
        public: false,
        private: false,
        unlisted: false,
      };

      for (const pick of picks) {
        newFilters[pick.privacy] = true;
      }

      await context.globalState.update("valtown.filters", newFilters);
      tree.filters = newFilters;
      await tree.refresh();
    })
  );
}
