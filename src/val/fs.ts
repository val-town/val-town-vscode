import { FullVal, ValtownClient } from "../client";
import * as vscode from "vscode";

export const FS_SCHEME = "vt+val";

class ValFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) {}

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  async extractVal(uri: vscode.Uri): Promise<FullVal> {
    const [author, filename] = uri.path.slice(1).split("/");
    const name = filename.split(".")[0];
    return this.client.resolveVal(author, name);
  }

  static extractVersion(uri: vscode.Uri) {
    const match = uri.path.match(/@(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }

  async readFile(uri: vscode.Uri) {
    const val = await this.extractVal(uri);
    if (uri.path.endsWith(".md")) {
      return new TextEncoder().encode(val.readme || "");
    }
    return new TextEncoder().encode(val.code || "");
  }

  async delete(uri: vscode.Uri) {
    const val = await this.extractVal(uri);
    await this.client.deleteVal(val.id);
    this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    vscode.commands.executeCommand("valtown.refresh");
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean }
  ) {
    const oldVal = await this.extractVal(oldUri);
    const name = newUri.path.split("/").pop()?.replace(".tsx", "");
    if (!name) {
      vscode.window.showErrorMessage("Invalid name");
      return;
    }

    await this.client.renameVal(oldVal.id, name);
    this._emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri },
    ]);
    vscode.commands.executeCommand("valtown.refresh");
  }

  async stat(uri: vscode.Uri) {
    if (uri.path.split("/").length < 3) {
      return {
        type: vscode.FileType.Directory,
        ctime: 0,
        mtime: 0,
        size: 0,
      };
    }

    try {
      const val = await this.extractVal(uri);
      const user = await this.client.user();

      return {
        type: vscode.FileType.File,
        permissions:
          val.author.id !== user.id
            ? vscode.FilePermission.Readonly
            : undefined,
        ctime: new Date(val.createdAt).getTime(),
        mtime: new Date(val.createdAt).getTime(),
        size: new TextEncoder().encode(val.code || "").length,
      };
    } catch (_) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
  ) {
    const val = await this.extractVal(uri);
    if (uri.path.endsWith(".md")) {
      await this.client.writeReadme(val.id, new TextDecoder().decode(content));
      return;
    }
    await this.client.writeVal(val.id, new TextDecoder().decode(content));
    vscode.commands.executeCommand("valtown.refresh");
  }

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    }
  ): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    vscode.window.showErrorMessage("Cannot create directories in ValTown");
  }

  async readDirectory(uri: vscode.Uri) {
    if (uri.path === "/") {
      vscode.window.showErrorMessage("Cannot read root directory");
      return [];
    }

    const username = uri.path.split("/").pop() || "";
    const user = await this.client.resolveUser(username);

    const vals = await this.client.paginate(`/users/${user.id}/vals`);
    return vals.map(
      (val) =>
        [`${val.name}.tsx`, vscode.FileType.File] as [string, vscode.FileType]
    );
  }
}

export function registerValFileSystemProvider(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  const fs = new ValFileSystemProvider(client);

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs),
    vscode.commands.registerCommand("valtown.val.openReadme", async (arg) => {
      let readmeUrl: string;
      if ("val" in arg) {
        const { author, name } = arg.val;
        readmeUrl = `vt+val:/${author.username}/${name}.md`;
      } else {
        const [author, filename] = arg.path.slice(1).split("/");
        const name = filename.split(".")[0];
        readmeUrl = `vt+val:/${author}/${name}.md`;
      }
      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(readmeUrl)
      );
    }),
    vscode.commands.registerCommand("valtown.val.open", async (arg) => {
      let readmeUrl: string;
      if ("val" in arg) {
        const { author, name } = arg.val;
        readmeUrl = `vt+val:/${author.username}/${name}.tsx`;
      } else {
        const [author, filename] = arg.path.slice(1).split("/");
        const name = filename.split(".")[0];
        readmeUrl = `vt+val:/${author}/${name}.tsx`;
      }
      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(readmeUrl)
      );
    })
  );
}
