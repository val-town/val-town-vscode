import { ValtownClient } from "../client";
import * as vscode from "vscode";

export const FS_SCHEME = "vt+val";

class ValFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) {}

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    new vscode.EventEmitter<vscode.FileChangeEvent[]>().event;

  static extractVersion(uri: vscode.Uri) {
    const match = uri.path.match(/@(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }

  async readFile(uri: vscode.Uri) {
    const filename = uri.path.slice(1);

    const val = await this.client.getVal(
      uri.authority,
      ValFileSystemProvider.extractVersion(uri)
    );

    if (filename.endsWith(".tsx")) {
      return new TextEncoder().encode(val.code || "");
    } else if (filename === "README.md") {
      return new TextEncoder().encode(val.readme || "");
    } else {
      throw new Error("Unknown file type");
    }
  }

  delete(uri: vscode.Uri): void | Thenable<void> {
    this.client.deleteVal(uri.authority);
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
    const version = ValFileSystemProvider.extractVersion(uri);
    const val = await this.client.getVal(uri.authority, version);
    const filename = uri.path.split("/").pop() || "";
    const uid = await this.client.uid();

    let readonly = false;
    if (filename === "README.md" || filename === "val.json") {
      readonly = true;
    } else if (typeof version !== "undefined") {
      readonly = true;
    } else if (val.author.id !== uid) {
      readonly = true;
    }

    return {
      type: vscode.FileType.File,
      permissions: readonly ? vscode.FilePermission.Readonly : undefined,
      ctime: new Date(val.runStartAt).getTime(),
      mtime: new Date(val.runStartAt).getTime(),
      size: new TextEncoder().encode(val.code || "").length,
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
  ) {
    const filename = uri.path.split("/").pop() || "";
    if (!filename.endsWith(".tsx")) {
      return;
    }

    await this.client.writeVal(
      uri.authority,
      new TextDecoder().decode(content)
    );

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

  readDirectory(
    uri: vscode.Uri
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    vscode.window.showErrorMessage("Cannot read directories in ValTown");
    return [];
  }
}

export function registerValFileSystemProvider(client: ValtownClient) {
  const fs = new ValFileSystemProvider(client);

  return vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs);
}
