"use strict";

import * as vscode from "vscode";

import { registerTreeView } from "./tree";
import { ValtownClient } from "./client";
import { registerFileSystemProvider } from "./fs";
import { loadToken } from "./secrets";
import { registerCommands } from "./commands";
import { registerUriHandler } from "./uri";

export async function activate(context: vscode.ExtensionContext) {
  // set output channel
  const outputChannel = vscode.window.createOutputChannel("Val Town");
  context.subscriptions.push(outputChannel);

  const config = vscode.workspace.getConfiguration("valtown")
  const endpoint = config.get<string>("endpoint", "https://api.val.town");
  outputChannel.appendLine(`Using endpoint: ${endpoint}`)

  let token = await loadToken(context);
  if (token) {
    await vscode.commands.executeCommand("setContext", "valtown.loggedIn", true)
  }

  const client = new ValtownClient(endpoint, token);
  context.secrets.onDidChange(async (e) => {
    if (e.key !== "valtown.token") {
      return;
    }

    const token = await loadToken(context);
    client.setToken(token);
    await vscode.commands.executeCommand("setContext", "valtown.loggedIn", !!token)
    await vscode.commands.executeCommand("valtown.refresh")
  })


  vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration("valtown.endpoint")) {
      return;
    }

    const token = await loadToken(context);
    client.setToken(token);
    await vscode.commands.executeCommand("setContext", "valtown.ready", token !== undefined)
    await vscode.commands.executeCommand("valtown.refresh")
  })




  outputChannel.appendLine("Registering uri handler");
  registerUriHandler(context);
  outputChannel.appendLine("Registering tree view");
  registerTreeView(context, client);
  outputChannel.appendLine("Registering file system provider");
  registerFileSystemProvider(client);
  outputChannel.appendLine("Registering commands");
  registerCommands(context, client);
  outputChannel.appendLine("ValTown extension activated");
}

export async function deactivate() { }
