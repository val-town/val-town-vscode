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
    options: { readonly overwrite: boolean },
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

    const val = await this.extractVal(uri);
    const user = await this.client.user();

    return {
      type: vscode.FileType.File,
      permissions: val.author.id !== user.id
        ? vscode.FilePermission.Readonly
        : undefined,
      ctime: new Date(val.createdAt).getTime(),
      mtime: new Date(val.runStartAt).getTime(),
      size: new TextEncoder().encode(val.code || "").length,
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean },
  ) {
    const val = await this.extractVal(uri);
    await this.client.writeVal(val.id, new TextDecoder().decode(content));
    vscode.commands.executeCommand("valtown.refresh");
  }

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    },
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
        [`${val.name}.tsx`, vscode.FileType.File] as [string, vscode.FileType],
    );
  }
}

export function registerValFileSystemProvider(client: ValtownClient) {
  const fs = new ValFileSystemProvider(client);

  return vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs);
}
