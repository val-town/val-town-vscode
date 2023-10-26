import { ValtownClient } from "./client";
import * as vscode from "vscode";

export const FS_SCHEME = "val";

class ValtownFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) { }

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    new vscode.EventEmitter<
      vscode.FileChangeEvent[]
    >().event;

  async readFile(uri: vscode.Uri) {
    const filename = uri.path.split("/").pop() || "";

    let version: number | undefined;
    const match = uri.path.match(/@(\d+)/)
    if (match) {
      version = parseInt(match[1]);
    }

    const val = await this.client.getVal(uri.authority, version);



    if (filename == "mod.ts" || filename == "mod.tsx") {
      return new TextEncoder().encode(val.code || "")
    } else if (filename === "README.md") {
      return new TextEncoder().encode(val.readme || "")
    } else if (filename === "val.json") {
      return new TextEncoder().encode(JSON.stringify(val, null, 2))
    }
    else {
      throw new Error("Unknown file type");
    }
  }

  delete(
    uri: vscode.Uri,
  ): void | Thenable<void> {
    this.client.deleteVal(uri.authority);
    vscode.commands.executeCommand("valtown.refresh");
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean },
  ): void | Thenable<void> {
    vscode.window.showErrorMessage("Cannot rename files in ValTown");
  }

  async stat(uri: vscode.Uri) {
    const filename = uri.path.split("/").pop() || "";
    await this.client.getVal(uri.authority);

    let readonly = false;
    if (filename === "README.md" || filename === "val.json") {
      readonly = true;
    } else if (uri.path.includes("@")) {
      readonly = true;
    }

    return {
      type: vscode.FileType.File,
      permissions: readonly ? vscode.FilePermission.Readonly : undefined,
      ctime: 0,
      mtime: 0,
      size: 0,
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean },
  ) {
    const filename = uri.path.split("/").pop() || "";
    if (!(filename == "mod.ts" || filename == "mod.tsx")) {
      return;
    }

    await this.client.writeVal(
      uri.authority,
      new TextDecoder().decode(content),
    );

    vscode.commands.executeCommand("valtown.refresh");
  }

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    },
  ): vscode.Disposable {
    return new vscode.Disposable(() => { });
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    vscode.window.showErrorMessage("Cannot create directories in ValTown");
  }

  readDirectory(
    uri: vscode.Uri,
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    vscode.window.showErrorMessage("Cannot read directories in ValTown");
    return [];
  }
}

export function registerFileSystemProvider(client: ValtownClient) {
  const fs = new ValtownFileSystemProvider(client);

  return vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs);
}
