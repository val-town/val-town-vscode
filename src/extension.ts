"use strict";

import * as vscode from "vscode";

import { registerTreeView } from "./tree";
import { ValtownClient } from "./client";
import { registerFileSystemProvider } from "./fs";
import { loadToken } from "./secrets";
import { registerCommands } from "./commands";

export async function activate(context: vscode.ExtensionContext) {
  // await context.secrets.delete("valtown.token");

  const config = vscode.workspace.getConfiguration("valtown")
  const endpoint = config.get<string>("endpoint", "https://api.val.town");

  let token = await loadToken(context);
  if (token) {
    await vscode.commands.executeCommand("setContext", "valtown.ready", true)
  } else {
    vscode.window.showInformationMessage("The ValTown extension requires a token to be provided.", "Set Token").then((value) => {
      if (value === "Set Token") {
        vscode.commands.executeCommand("valtown.setToken")
      }
    })
  }

  const client = new ValtownClient(endpoint, token);
  context.secrets.onDidChange(async (e) => {
    if (e.key !== "valtown.token") {
      return;
    }

    const token = await loadToken(context);
    client.setToken(token);
    await vscode.commands.executeCommand("setContext", "valtown.ready", token !== undefined)
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



  registerTreeView(context, client);
  registerFileSystemProvider(client);
  registerCommands(context, client);
}
