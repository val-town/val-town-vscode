import * as vscode from "vscode";
import { BaseVal, ValtownClient } from "../client";

type ValTreeItem = vscode.TreeItem & { val?: BaseVal };

type ValFolder = {
  title: string;
  icon?: string;
  expanded?: boolean;
  url: string;
};

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

function valToTreeItem(val: BaseVal): ValTreeItem {
  const resourceUri = `vt+val:/${val.author.username.slice(1)}/${val.name}.tsx`;

  return {
    contextValue: "val",
    resourceUri: vscode.Uri.parse(resourceUri),
    label: val.name,
    tooltip: `v${val.version}`,
    description: val.author.username,
    iconPath: valIcon(val.privacy),
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    val,
    command: {
      command: "vscode.open",
      title: "Open Val",
      arguments: [resourceUri],
    },
  } as vscode.TreeItem & { val: BaseVal };
}

export class ValTreeView implements vscode.TreeDataProvider<vscode.TreeItem> {
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

  async getChildren(element?: (vscode.TreeItem & ValFolder) | undefined) {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const config = vscode.workspace.getConfiguration("valtown");
      const folders = config.get<ValFolder[]>("folders", []);

      return folders.map((section, idx) => ({
        idx,
        label: section.title,
        iconPath: section.icon
          ? new vscode.ThemeIcon(section.icon)
          : new vscode.ThemeIcon("folder"),
        collapsibleState: section.expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        ...section,
      }));
    }

    const user = await this.client.user();
    element.url = element.url.replace("${uid}", user.id);
    const vals = await this.client.paginate(element.url);
    return vals.map((val) => valToTreeItem(val));
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

class DependencyTreeViewProvider
  implements vscode.TreeDataProvider<ValTreeItem>
{
  constructor(private client: ValtownClient) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    ValTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ValTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ValTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element?: ValTreeItem) {
    let code: string | undefined;
    if (element) {
      code = element.val!.code;
    } else {
      code = vscode.window.activeTextEditor?.document.getText();
    }

    if (!code) {
      return [
        {
          label: "No dependencies found",
        },
      ];
    }
    const urlPattern =
      /https:\/\/esm\.town\/v\/([a-zA-Z_$][0-9a-zA-Z_$]*)\/([a-zA-Z_$][0-9a-zA-Z_$]*)/g;

    const matches = [...code.matchAll(urlPattern)];
    if (matches.length === 0) {
      return [
        {
          label: "No dependencies found",
        },
      ];
    }

    const vals = await Promise.all(
      matches.map(async (match) => {
        const [, author, name] = match;
        return await this.client.resolveAlias(author, name);
      })
    );

    return vals.map((val) => {
      const item = valToTreeItem(val);
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    });
  }

  getTreeItem(
    element: vscode.TreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

class ReferenceTreeViewProvider
  implements vscode.TreeDataProvider<ValTreeItem>
{
  constructor(private client: ValtownClient) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    ValTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ValTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ValTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(
    element: ValTreeItem | undefined
  ): Promise<vscode.TreeItem[]> {
    let esmUrl: string;
    if (element) {
      // prettier-ignore
      esmUrl = `"https://esm.town/v/${element.val!.author.username.slice(1)}/${element.val!.name}"`;
    } else {
      const resourceUri = vscode.window.activeTextEditor?.document.uri;
      const [author, filename] = resourceUri?.path.slice(1).split("/") || [];
      if (!author || !filename) {
        return [];
      }
      esmUrl = `"https://esm.town/v/${author}/${filename.split(".")[0]}"`;
    }
    const vals = await (
      await this.client.searchVals(esmUrl)
    ).filter((val) => {
      return val.code.includes(esmUrl);
    });

    if (vals.length === 0) {
      return [
        {
          label: "No references found",
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        },
      ];
    }
    return vals.map((val) => {
      const item = valToTreeItem(val);
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    });
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
  const valTree = new ValTreeView(client);
  context.subscriptions.push(
    vscode.window.createTreeView("valtown.vals", {
      treeDataProvider: valTree,
      showCollapseAll: true,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.refresh", async () => {
      valTree.refresh();
    })
  );

  const references = new ReferenceTreeViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("valtown.references", references)
  );

  const dependencies = new DependencyTreeViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("valtown.dependencies", dependencies)
  );

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor?.document.uri.scheme === "vt+val") {
      references.refresh();
      dependencies.refresh();
    }
  });
}
