import ValTown from "@valtown/sdk";
import * as vscode from "vscode";


export const FS_SCHEME = "vt+val";

// uri: vt+val:id/<val>[@version]/<filename>

class ValFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValTown) { }

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  async readFile(uri: vscode.Uri) {
    try {
      const file = await this.client.vals.files.getContent(uri.authority, {
        path: uri.path.slice(1),
      })
      return new TextEncoder().encode(await file.text())
    } catch (error) {
      if (error instanceof ValTown.APIError) {
        if (error.status === 404) {
          throw vscode.FileSystemError.FileNotFound(uri);
        }

        throw vscode.FileSystemError.Unavailable(uri)
      } else {
        throw vscode.FileSystemError.Unavailable(uri);
      }
    }
  }

  async delete(uri: vscode.Uri, options: { recursive: boolean }) {
    await this.client.vals.files.delete(uri.authority, {
      path: uri.path.slice(1),
      recursive: options.recursive,
    });

    this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  async rename(
    _oldUri: vscode.Uri,
    _newUri: vscode.Uri,
    _options: { readonly overwrite: boolean }
  ) {
    await vscode.window.showErrorMessage(
      "Renaming files in Val Town is not supported yet."
    );
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const files = []
    if (uri.path === "/") {
      const val = await this.client.vals.retrieve(uri.authority)
      return {
        type: vscode.FileType.Directory,
        ctime: new Date(val.createdAt).getTime(),
        mtime: new Date(val.createdAt).getTime(),
        size: 0,
      };
    }

    for await (const res of this.client.vals.files.retrieve(
      uri.authority,
      {
        path: uri.path.slice(1),
        recursive: false
      }
    )) {
      files.push(res)
    }

    const file = files.find((file) => file.path === uri.path.slice(1));
    if (!file) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return {
      type: file.type === "directory"
        ? vscode.FileType.Directory
        : vscode.FileType.File,
      ctime: new Date(file.updatedAt).getTime(),
      mtime: new Date(file.updatedAt).getTime(),
      size: 0
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
  ) {
    await this.client.vals.files.update(uri.authority, {
      path: uri.path.slice(1),
      content: new TextDecoder().decode(content),
    })

    this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    }
  ): vscode.Disposable {
    return new vscode.Disposable(() => { });
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    await this.client.vals.files.create(uri.authority, {
      path: uri.path.slice(1),
      type: "directory",
    })
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const files: ValTown.Vals.Files.FileRetrieveResponse[] = []
    for await (const res of this.client.vals.files.retrieve(
      uri.authority,
      {
        path: uri.path.slice(1),
        recursive: false,
      }
    )) {
      files.push(res)
    }


    return files.map(
      (file) =>
        [
          file.path.split("/").pop() || "",
          file.type === "directory"
            ? vscode.FileType.Directory
            : vscode.FileType.File,
        ]
    );
  }
}

export function registerValFileSystemProvider(
  context: vscode.ExtensionContext,
  client: ValTown
) {
  const fs = new ValFileSystemProvider(client);

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(FS_SCHEME, fs),
  )
}
