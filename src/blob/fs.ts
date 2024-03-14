import { ValtownClient } from "../client";
import * as vscode from "vscode";

export const FS_SCHEME = "vt+blob";

class BlobFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValtownClient) {}
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  async readFile(uri: vscode.Uri) {
    const key = uri.path.slice(1);
    return this.client.readBlob(key);
  }

  async delete(uri: vscode.Uri) {
    const key = uri.path.slice(1);
    await this.client.deleteBlob(key);
    this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    await vscode.commands.executeCommand("valtown.blob.refresh");
  }

  async rename(
    source: vscode.Uri,
    destination: vscode.Uri,
    options: { readonly overwrite: boolean }
  ) {
    const oldKey = source.path.slice(1);
    const newKey = destination.path.slice(1);
    await this.client.renameBlob(oldKey, newKey);
    this._emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: source },
      { type: vscode.FileChangeType.Created, uri: destination },
    ]);
    await vscode.commands.executeCommand("valtown.blob.refresh");
  }

  async copy(
    source: vscode.Uri,
    destination: vscode.Uri,
    options: { readonly overwrite: boolean }
  ) {
    const oldKey = source.path.slice(1);
    const newKey = destination.path.slice(1);
    await this.client.copyBlob(oldKey, newKey);
    this._emitter.fire([
      { type: vscode.FileChangeType.Created, uri: destination },
    ]);
    await vscode.commands.executeCommand("valtown.blob.refresh");
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
    // ignore, fires for all changes...
    return new vscode.Disposable(() => {});
  }

  createDirectory(uri: vscode.Uri) {}

  async readDirectory(uri: vscode.Uri) {
    const blobs = await this.client.listBlobs();
    return blobs.map(
      (blob) => [blob.key, vscode.FileType.File] as [string, vscode.FileType]
    );
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
    vscode.commands.registerCommand("valtown.blob.create", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Enter a name for the new blob",
      });
      if (!input) {
        return;
      }

      const uri = vscode.Uri.parse(`vt+blob:/${encodeURIComponent(input)}`);
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode("\n"));
      await vscode.commands.executeCommand("vscode.open", uri);
      await vscode.commands.executeCommand("valtown.blob.refresh");
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
      await vscode.commands.executeCommand("valtown.blob.refresh");
    }),
    vscode.commands.registerCommand("valtown.blob.download", async (arg) => {
      const key = arg.id;
      const blobUri = vscode.Uri.parse(`vt+blob:/${encodeURIComponent(key)}`);

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
      await vscode.workspace.fs.delete(
        vscode.Uri.parse(`vt+blob:/${encodeURIComponent(key)}`)
      );

      await vscode.commands.executeCommand("valtown.blob.refresh");
    }),
    vscode.commands.registerCommand("valtown.blob.rename", async (arg) => {
      const key = arg.id;
      const oldUri = vscode.Uri.parse(`vt+blob:/${encodeURIComponent(key)}`);
      const newUri = await vscode.window.showSaveDialog({
        defaultUri: oldUri,
        saveLabel: "Rename",
        title: "Rename blob",
      });

      if (!newUri) {
        return;
      }

      await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: true });

      await vscode.commands.executeCommand("valtown.blob.refresh");
    }),
    vscode.commands.registerCommand("valtown.blob.copyKey", async (arg) => {
      const key = arg.id;
      await vscode.env.clipboard.writeText(key);
    })
  );
}
