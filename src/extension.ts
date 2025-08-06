"use strict";

import * as vscode from "vscode";

import ValTown from "@valtown/sdk";
import { registerBlobFileSystemProvider } from "./blob/fs";
import { registerBlobTreeView } from "./blob/tree";
import { registerCommands } from "./commands";
import { loadToken, saveToken } from "./secrets";
import { registerSqliteTextDocumentProvider } from "./sqlite/document";
import { registerSqliteTreeView } from "./sqlite/tree";
import { registerValFileSystemProvider } from "./val/fs";
import { registerValTreeView } from "./val/tree";

export async function activate(context: vscode.ExtensionContext) {
  // set output channel


  let token = await loadToken(context);
  if (token) {
    await vscode.commands.executeCommand(
      "setContext",
      "valtown.loggedIn",
      true,
    );
  }

  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration("valtown.endpoint")) {
      return;
    }

    const token = await loadToken(context);
    await vscode.commands.executeCommand(
      "setContext",
      "valtown.ready",
      token !== undefined,
    );
    await vscode.commands.executeCommand("valtown.refresh");
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "valtown.setToken",
      async (token?: string) => {
        if (!token) {
          token = await vscode.window.showInputBox({
            prompt: "ValTown Token",
            placeHolder: "Token",
            validateInput: async (value) => {
              if (!value) {
                return "Token cannot be empty";
              }
            },
          });

          if (!token) {
            return;
          }
        }

        await saveToken(context, token);
        init(context, token);
      },
    )
  );

  if (!token) {
    return;
  }

  init(context, token);
}

function init(context: vscode.ExtensionContext, token: string) {
  const config = vscode.workspace.getConfiguration("valtown");
  const endpoint = config.get<string>("endpoint", "https://api.val.town");
  const client = new ValTown({ bearerToken: token, baseURL: endpoint });

  registerCommands(context);
  registerBlobTreeView(context, client);
  registerSqliteTreeView(context, client);
  registerSqliteTextDocumentProvider(context, client);
  registerValTreeView(context, client);
  registerValFileSystemProvider(context, client);

  const outputChannel = vscode.window.createOutputChannel("Val Town");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Registering file system provider");
  registerBlobFileSystemProvider(context, new ValTown({ bearerToken: token }));
}

export async function deactivate() { }
