import { ValtownClient } from "../client";
import * as vscode from "vscode";

export const FS_SCHEME = "vt+blob";

class BlobFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) {}

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    new vscode.EventEmitter<vscode.FileChangeEvent[]>().event;

  async readFile(uri: vscode.Uri) {
    const key = uri.path.slice(1);
    return this.client.readBlob(key);
  }

  async delete(uri: vscode.Uri) {
    const key = uri.path.slice(1);
    await this.client.deleteBlob(key);
    await vscode.commands.executeCommand("valtown.blob.refresh");
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean }
  ): void | Thenable<void> {
    vscode.window.showErrorMessage("Cannot rename files in ValTown");
  }

  async stat(uri: vscode.Uri) {
    const prefix = uri.path.slice(1);
    const files = await this.client.listBlobs(uri.path.slice(1));
    if (files.length === 0) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const isDir = files[0].key !== prefix;
    return {
      type: isDir ? vscode.FileType.Directory : vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: isDir ? 0 : 100,
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
  ) {
    await this.client.writeBlob(uri.path.slice(1), content);
    await vscode.commands.executeCommand("valtown.refresh");
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
    let prefix = uri.path.slice(1);
    if (prefix && !prefix.endsWith("/")) {
      prefix += "/";
    }
    const files: Record<string, vscode.FileType> = {};
    for (const blob of await this.client.listBlobs(prefix)) {
      const parts = blob.key.slice(prefix.length).split("/");
      files[parts[0]] =
        parts.length > 1 ? vscode.FileType.Directory : vscode.FileType.File;
    }
    const result = Object.entries(files);
    return result;
  }
}

export function registerBlobFileSystemProvider(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  const fs = new BlobFileSystemProvider(client);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs),
    vscode.commands.registerCommand("valtown.blob.quickOpen", async () => {
      const uris = await vscode.window.showOpenDialog({
        defaultUri: vscode.Uri.parse("vt+blob:/"),
        title: "Select a blob to open",
      });

      if (!uris || uris.length === 0) {
        return;
      }

      await vscode.commands.executeCommand("vscode.open", uris[0]);
    }),
    vscode.commands.registerCommand("valtown.blob.upload", async (arg) => {
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Upload",
      });

      if (!fileUris || fileUris.length === 0) {
        return;
      }
      const fileUri = fileUris[0];
      const filename = fileUri.path.split("/").pop() || "";

      const blobUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.parse("vt+blob:/"),
        saveLabel: "Upload",
        title: "Save blob as",
      });
      if (!blobUri) {
        return;
      }

      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      await vscode.workspace.fs.writeFile(blobUri, fileContent);
      await vscode.window.showInformationMessage(`Uploaded ${filename}`);
    }),
    vscode.commands.registerCommand("valtown.blob.download", async (arg) => {
      const key = arg.id;
      const blobUri = vscode.Uri.parse(`vt+blob:/${key}`);

      const fileUri = await vscode.window.showSaveDialog({
        saveLabel: "Download",
        title: "Save blob as",
      });
      if (!fileUri) {
        return;
      }

      const blobContent = await vscode.workspace.fs.readFile(blobUri);
      await vscode.workspace.fs.writeFile(fileUri, blobContent);
      await vscode.window.showInformationMessage(`Downloaded ${key}`);
    }),
    vscode.commands.registerCommand("valtown.blob.delete", async (arg) => {
      const key = arg.id;
      await vscode.workspace.fs.delete(vscode.Uri.parse(`vt+blob:/${key}`));
    })
  );
}
