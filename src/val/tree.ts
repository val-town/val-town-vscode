import * as vscode from "vscode";
import { BaseVal, ValtownClient } from "../client";

type ValTreeItem = vscode.TreeItem & { val?: BaseVal };

type ValFolder = {
  title: string;
  icon?: string;
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

function valToTreeItem(
  val: BaseVal,
  collapsibleState: vscode.TreeItemCollapsibleState,
): ValTreeItem {
  const resourceUri = `vt+val:/${val.author.username.slice(1)}/${val.name}.tsx`;

  return {
    contextValue: "val",
    resourceUri: vscode.Uri.parse(resourceUri),
    label: val.name,
    tooltip: `v${val.version}`,
    description: val.author.username,
    iconPath: valIcon(val.privacy),
    collapsibleState,
    val,
    command: {
      command: "vscode.open",
      title: "Open Val",
      arguments: [resourceUri],
    },
  } as vscode.TreeItem & { val: BaseVal };
}

function hasDeps(val: BaseVal) {
  return /https:\/\/esm\.town\/v\/([a-zA-Z_$][0-9a-zA-Z_$]*)\/([a-zA-Z_$][0-9a-zA-Z_$]*)/
    .test(
      val.code,
    );
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

  async getChildren(
    element?: (vscode.TreeItem & ValFolder) | ValTreeItem | undefined,
  ) {
    if (!this.client.authenticated) {
      return [];
    }

    if (!element) {
      const config = vscode.workspace.getConfiguration("valtown");
      const folders = config.get<ValFolder[]>("folders", []);

      return folders.map((folder, idx) => ({
        idx,
        label: folder.title,
        iconPath: folder.icon
          ? new vscode.ThemeIcon(folder.icon)
          : new vscode.ThemeIcon("folder"),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        ...folder,
      }));
    }

    if ("val" in element && element.val) {
      const vals = await this.client.extractDependencies(element.val.code);
      if (vals.length === 0) {
        return [
          {
            label: "No dependencies found",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
          },
        ];
      }

      return vals.map((val) =>
        valToTreeItem(
          val,
          hasDeps(val)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        )
      );
    }

    if ("url" in element) {
      const user = await this.client.user();
      element.url = element.url.replace("${uid}", user.id);
      const vals = await this.client.paginate(element.url);
      if (vals.length === 0) {
        return [
          {
            label: "No vals found",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
          },
        ];
      }
      return vals.map((val) =>
        valToTreeItem(
          val,
          hasDeps(val)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        )
      );
    }

    // TODO: This is a bit of a hack, but it works for now
    throw new Error("Unknown element");
  }

  getTreeItem(
    element: vscode.TreeItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

class DependencyTreeViewProvider
  implements vscode.TreeDataProvider<ValTreeItem> {
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
    const vals = await this.client.extractDependencies(code);
    if (vals.length === 0) {
      return [
        {
          label: "No dependencies found",
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        },
      ];
    }

    return vals.map((val) =>
      valToTreeItem(
        val,
        hasDeps(val)
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      )
    );
  }

  getTreeItem(
    element: vscode.TreeItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

class PinTreeViewProvider implements vscode.TreeDataProvider<ValTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ValTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ValTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ValTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  constructor(private client: ValtownClient) {}

  async getChildren(element?: ValTreeItem | undefined) {
    if (!element) {
      const config = vscode.workspace.getConfiguration("valtown");
      const pins = config.get<string[]>("pins", []);
      const vals = await Promise.all(
        pins.map((pin) => {
          const [author, name] = pin.slice(1).split("/");
          return this.client.resolveAlias(author, name);
        }),
      );

      if (vals.length === 0) {
        return [
          {
            label: "No pinned vals found",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
          },
        ];
      }

      return vals.map((val) =>
        valToTreeItem(
          val,
          hasDeps(val)
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        )
      );
    }

    const vals = await this.client.extractDependencies(element.val!.code);
    if (vals.length === 0) {
      return [
        {
          label: "No dependencies found",
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        },
      ];
    }

    return vals.map((val) =>
      valToTreeItem(
        val,
        hasDeps(val)
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      )
    );
  }

  getTreeItem(element: ValTreeItem) {
    return element;
  }
}

class ReferenceTreeViewProvider
  implements vscode.TreeDataProvider<ValTreeItem> {
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
    element: ValTreeItem | undefined,
  ): Promise<vscode.TreeItem[]> {
    const resourceUri = vscode.window.activeTextEditor?.document.uri;
    const [author, filename] = resourceUri?.path.slice(1).split("/") || [];
    if (!author || !filename) {
      return [];
    }

    const esmUrl = `https://esm.town/v/${author}/${filename.split(".")[0]}`;
    const vals = await (
      await this.client.searchVals(esmUrl)
    ).filter((val) => {
      return val.code.includes(esmUrl + '"') || val.code.includes(esmUrl + "?");
    });

    if (vals.length === 0) {
      return [
        {
          label: "No references found",
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        },
      ];
    }
    return vals.map((val) =>
      valToTreeItem(val, vscode.TreeItemCollapsibleState.None)
    );
  }

  getTreeItem(
    element: vscode.TreeItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
}

export async function registerValTreeView(
  context: vscode.ExtensionContext,
  client: ValtownClient,
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
      if (e.affectsConfiguration("valtown.folders")) {
        valTree.refresh();
      }
    }),
  );

  const referenceTree = new ReferenceTreeViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("valtown.references", referenceTree),
  );

  const dependencyTree = new DependencyTreeViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "valtown.dependencies",
      dependencyTree,
    ),
  );

  const pins = new PinTreeViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("valtown.pins", pins),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("valtown.pins")) {
        pins.refresh();
      }
    }),
  );

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor?.document.uri.scheme === "vt+val") {
      referenceTree.refresh();
      dependencyTree.refresh();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("valtown.refresh", async () => {
      valTree.refresh();
    }),
    vscode.commands.registerCommand("valtown.vals.refresh", async () => {
      valTree.refresh();
      pins.refresh();
    }),
    vscode.commands.registerCommand("valtown.pins.refresh", async () => {
      pins.refresh();
    }),
    vscode.commands.registerCommand("valtown.vals.config", async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "valtown.folders",
      );
    }),
    vscode.commands.registerCommand("valtown.pins.config", async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "valtown.pins",
      );
    }),
  );
}
