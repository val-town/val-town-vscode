import { FullVal, ValtownClient } from "../client";
import * as vscode from "vscode";

export const FS_SCHEME = "vt+val";

class ValFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) {}

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    new vscode.EventEmitter<vscode.FileChangeEvent[]>().event;

  async extractVal(uri: vscode.Uri): Promise<FullVal> {
    const [author, filename] = uri.path.slice(1).split("/");
    const name = filename.split(".")[0];
    return this.client.resolveAlias(author, name);
  }

  static extractVersion(uri: vscode.Uri) {
    const match = uri.path.match(/@(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }

  async readFile(uri: vscode.Uri) {
    const val = await this.extractVal(uri);
    if (uri.path.endsWith(".tsx")) {
      return new TextEncoder().encode(val.code || "");
    } else if (uri.path.endsWith(".md")) {
      return new TextEncoder().encode(val.readme || "");
    } else {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  async delete(uri: vscode.Uri) {
    const val = await this.extractVal(uri);
    this.client.deleteVal(val.id);
    vscode.commands.executeCommand("valtown.refresh");
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean }
  ): void | Thenable<void> {
    vscode.window.showErrorMessage("Cannot rename files in ValTown");
  }

  async stat(uri: vscode.Uri) {
    const val = await this.extractVal(uri);
    const user = await this.client.user();

    let readonly = false;
    if (uri.path.endsWith(".md")) {
      readonly = true;
    } else if (val.author.id !== user.id) {
      readonly = true;
    }

    return {
      type: vscode.FileType.File,
      permissions: readonly ? vscode.FilePermission.Readonly : undefined,
      ctime: new Date(val.createdAt).getTime(),
      mtime: new Date(val.runStartAt).getTime(),
      size: new TextEncoder().encode(val.code || "").length,
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
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
    const user = await this.client.resolveAlias(username);

    const vals = await this.client.paginate(`/users/${user.id}/vals`);
    return vals.map(
      (val) =>
        [`${val.name}.tsx`, vscode.FileType.File] as [string, vscode.FileType]
    );
  }
}

export function registerValFileSystemProvider(client: ValtownClient) {
  const fs = new ValFileSystemProvider(client);

  return vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs);
}
