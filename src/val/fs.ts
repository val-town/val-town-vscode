import ValTown from "@valtown/sdk";
import * as vscode from "vscode";


export const FS_SCHEME = "vt+val";

// uri: vt+val:/<author>/<val>[@version]/<filename>

class ValFileSystemProvider implements vscode.FileSystemProvider {
  constructor(private client: ValTown) { }

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  async readFile(uri: vscode.Uri) {
    const [author, name, ...parts] = uri.path.slice(1).split("/");
    const filepath = parts.join("/");
    const val = await this.client.alias.username.valName.retrieve(author, name);
    const file = await this.client.vals.files.getContent(val.id, {
      path: filepath,
    })
    return new TextEncoder().encode(await file.text())
  }

  async delete(uri: vscode.Uri, options: { recursive: boolean }) {
    vscode.window.showErrorMessage("Deleting files is not supported yet");
    // const [author, name, ...parts] = uri.path.slice(1).split("/");
    // const filepath = parts.join("/");
    // const val = await this.client.alias.username.valName.retrieve(author, name);

    // await this.client.vals.files.delete(val.id, { path: filepath, recursive: options.recursive });
    // this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    // vscode.commands.executeCommand("valtown.refresh");
  }

  async resolveVal(uri: vscode.Uri) {
    const [author, name] = uri.path.slice(1).split("/");
    return this.client.alias.username.valName.retrieve(author, name);
  }

  async rename(
    _oldUri: vscode.Uri,
    _newUri: vscode.Uri,
    _options: { readonly overwrite: boolean }
  ) {
    vscode.window.showErrorMessage("Renaming vals is not supported yet");
  }

  async stat(uri: vscode.Uri) {
    const [author, name, ...parts] = uri.path.slice(1).split("/");
    const filepath = parts.join("/");
    const val = await this.client.alias.username.valName.retrieve(author, name);
    const files = []
    for await (const res of this.client.vals.files.retrieve(
      val.id,
      {
        path: filepath,
        recursive: false
      }
    )) {
      files.push(res)
    }

    return {
      type: vscode.FileType.File,
      permissions: vscode.FilePermission.Readonly,
      ctime: new Date(val.createdAt).getTime(),
      mtime: new Date(val.createdAt).getTime(),
      size: 0
    };
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean }
  ) {
    vscode.window.showErrorMessage("Writing files is not supported yet");
    // const [author, name, ...parts] = uri.path.slice(1).split("/");
    // const filepath = parts.join("/");
    // const val = await this.client.alias.username.valName.retrieve(author, name);

    // await this.client.vals.files.update(val.id, {
    //   path: filepath,
    //   content: new TextDecoder().decode(content),
    // })

    // this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
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

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    vscode.window.showErrorMessage("Creating directories is not supported yet");
  }

  async readDirectory(uri: vscode.Uri) {
    vscode.window.showErrorMessage("Reading directories is not supported yet");
    return []
  }
}

export function registerValFileSystemProvider(
  context: vscode.ExtensionContext,
  client: ValTown
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
