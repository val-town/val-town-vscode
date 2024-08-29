"use strict";

import * as vscode from "vscode";

import { registerValTreeView } from "./val/tree";
import { registerBlobTreeView } from "./blob/tree";
import { ValtownClient } from "./client";
import { registerValFileSystemProvider } from "./val/fs";
import { registerSqliteTreeView } from "./sqlite/tree";
import { registerBlobFileSystemProvider } from "./blob/fs";
import { loadToken } from "./secrets";
import { registerCommands } from "./commands";
import { registerUriHandler } from "./uri";
import * as sqliteDoc from "./sqlite/document";
import * as definition from "./definition";
import { registerCompletions } from "./completions";

export async function activate(context: vscode.ExtensionContext) {
  // set output channel
  const outputChannel = vscode.window.createOutputChannel("Val Town");
  context.subscriptions.push(outputChannel);

  const config = vscode.workspace.getConfiguration("valtown");
  const endpoint = config.get<string>("endpoint", "https://api.val.town");
  outputChannel.appendLine(`Using endpoint: ${endpoint}`);

  let token = await loadToken(context);
  if (token) {
    await vscode.commands.executeCommand(
      "setContext",
      "valtown.loggedIn",
      true,
    );
  }

  const client = new ValtownClient(endpoint, token);
  context.secrets.onDidChange(async (e) => {
    if (e.key !== "valtown.token") {
      return;
    }

    const token = await loadToken(context);
    client.setToken(token);
    await vscode.commands.executeCommand(
      "setContext",
      "valtown.loggedIn",
      !!token,
    );
    await vscode.commands.executeCommand("valtown.refresh");
    await vscode.commands.executeCommand("valtown.blob.refresh");
  });

  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration("valtown.endpoint")) {
      return;
    }

    const token = await loadToken(context);
    client.setToken(token);
    await vscode.commands.executeCommand(
      "setContext",
      "valtown.ready",
      token !== undefined,
    );
    await vscode.commands.executeCommand("valtown.refresh");
  });

  outputChannel.appendLine("Registering uri handler");
  registerUriHandler(context, client);
  outputChannel.appendLine("Registering tree view");
  registerValTreeView(context, client);
  registerBlobTreeView(context, client);
  registerSqliteTreeView(context, client);
  sqliteDoc.register(context, client);
  registerSqliteTreeView;
  outputChannel.appendLine("Registering file system provider");
  registerBlobFileSystemProvider(context, client);
  registerValFileSystemProvider(context, client);
  definition.register(client, context);
  outputChannel.appendLine("Registering commands");
  registerCommands(context, client);
  outputChannel.appendLine("Registering completions");
  registerCompletions(context, client);
  outputChannel.appendLine("ValTown extension activated");
}

export async function deactivate() {}
