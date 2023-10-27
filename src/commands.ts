import * as vscode from "vscode";
import { clearToken, saveToken } from "./secrets";
import { FullVal, ValtownClient } from "./client";
import { valIcon } from "./tree";

export function registerCommands(
  context: vscode.ExtensionContext,
  client: ValtownClient
) {
  function extractValID(arg: unknown) {
    if (!arg) {
      if (!(vscode.window.activeTextEditor?.document.uri.scheme === "val")) {
        throw new Error("No val selected");
      }

      return vscode.window.activeTextEditor?.document.uri.authority as string;
    }

    if (typeof arg === "string") {
      return arg;
    }

    if (typeof arg !== "object") {
      throw new Error("Could not extract val ID");
    }

    if ("id" in arg && typeof arg.id === "string") {
      return arg.id.split("/").pop() as string;
    }

    if ("authority" in arg && typeof arg.authority === "string") {
      return arg.authority as string;
    }

    throw new Error("Could not extract val ID");
  }

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
      }
    ),
    vscode.commands.registerCommand("valtown.clearToken", async () => {
      await clearToken(context);
    }),

    vscode.commands.registerCommand("valtown.createVal", async () => {
      const val = await client.createVal();

      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          `val://${val.id}/${val.author?.username?.slice(1)}/${
            val.name
          }/mod.tsx`
        )
      );

      vscode.commands.executeCommand("valtown.refresh");
    }),

    vscode.commands.registerCommand("valtown.sortHomeByName", async () => {
      context.workspaceState.update("homeSortState", "name");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortPinnedByName", async () => {
      context.workspaceState.update("pinnedSortState", "name");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortLikedByName", async () => {
      context.workspaceState.update("likedSortState", "name");
      vscode.commands.executeCommand("valtown.refresh");
    }),

    vscode.commands.registerCommand("valtown.sortHomeByPrivacy", async () => {
      context.workspaceState.update("homeSortState", "privacy");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortPinnedByPrivacy", async () => {
      context.workspaceState.update("pinnedSortState", "privacy");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortLikedByPrivacy", async () => {
      context.workspaceState.update("likedSortState", "privacy");
      vscode.commands.executeCommand("valtown.refresh");
    }),

    vscode.commands.registerCommand("valtown.sortHomeByRun", async () => {
      context.workspaceState.update("homeSortState", "run");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortPinnedByRun", async () => {
      context.workspaceState.update("pinnedSortState", "run");
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.sortLikedByRun", async () => {
      context.workspaceState.update("likedSortState", "run");
      vscode.commands.executeCommand("valtown.refresh");
    }),

    vscode.commands.registerCommand("valtown.clearHomeSort", async () => {
      context.workspaceState.update("homeSortState", undefined);
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.clearPinnedSort", async () => {
      context.workspaceState.update("pinnedSortState", undefined);
      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.clearLikedSort", async () => {
      context.workspaceState.update("likedSortState", undefined);
      vscode.commands.executeCommand("valtown.refresh");
    }),

    vscode.commands.registerCommand("valtown.viewReadme", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.commands.executeCommand(
        "vscode.openWith",
        vscode.Uri.parse(
          `val://${valID}/${val.author?.username?.slice(1)}/${
            val.name
          }/README.md`
        ),
        "vscode.markdown.preview.editor"
      );
    }),
    vscode.commands.registerCommand("valtown.copyAsJSON", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(JSON.stringify(val, null, 2));
    }),
    vscode.commands.registerCommand("valtown.copyImport", async (arg) => {
      const valID = extractValID(arg);

      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `import { ${
          val.name
        } } from "https://esm.town/v/${val.author.username.slice(1)}/${
          val.name
        }"`
      );
      vscode.window.showInformationMessage(
        `Import statement copied to clipboard`
      );
    }),

    vscode.commands.registerCommand("valtown.copyID", async (arg) => {
      const valID = extractValID(arg);

      vscode.env.clipboard.writeText(valID);
      vscode.window.showInformationMessage(`Val ID copied to clipboard`);
    }),

    vscode.commands.registerCommand("valtown.copyRunEndpoint", async (arg) => {
      const valID = extractValID(arg);

      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://api.val.town/v1/run/${val.author?.username?.slice(1)}.${
          val.name
        }`
      );
      vscode.window.showInformationMessage(
        `Val run endpoint copied to clipboard`
      );
    }),
    vscode.commands.registerCommand("valtown.deleteVal", async (arg) => {
      const valID = extractValID(arg);

      await client.deleteVal(valID);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.openInBrowser", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      await vscode.env.openExternal(
        vscode.Uri.parse(
          `https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`
        )
      );
    }),
    vscode.commands.registerCommand(`valtown.copyWebEndpoint`, async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://${val.author?.username?.slice(1)}-${val.name}.web.val.run`
      );
      vscode.window.showInformationMessage(
        `Val web endpoint copied to clipboard`
      );
    }),
    vscode.commands.registerCommand(
      `valtown.copyExpressEndpoint`,
      async (arg) => {
        const valID = extractValID(arg);
        const val = await client.getVal(valID);
        await vscode.env.clipboard.writeText(
          `https://${val.author?.username?.slice(1)}-${
            val.name
          }.express.val.run`
        );
        vscode.window.showInformationMessage(
          `Val express endpoint copied to clipboard`
        );
      }
    ),
    vscode.commands.registerCommand("valtown.copyLink", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`
      );
      vscode.window.showInformationMessage(`Val link copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openLogs", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      await vscode.env.openExternal(
        vscode.Uri.parse(
          `https://val.town/v/${val.author?.username?.slice(1)}/${
            val.name
          }/evaluations`
        )
      );
    }),
    vscode.commands.registerCommand("valtown.copyEmbed", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://val.town/embed/${val.author?.username?.slice(1)}.${val.name}`
      );
      vscode.window.showInformationMessage(
        `Val embed link copied to clipboard`
      );
    }),
    vscode.commands.registerCommand("valtown.togglePinned", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      const pinnedVals = context.globalState.get<Record<string, FullVal>>(
        "valtown.pins",
        {}
      );
      if (pinnedVals[valID]) {
        delete pinnedVals[valID];
      } else {
        pinnedVals[valID] = val;
      }
      await context.globalState.update("valtown.pins", pinnedVals);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.copyEmailAddress", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      await vscode.env.clipboard.writeText(
        `${val.author?.username?.slice(1)}.${val.name}@val.town`
      );
      vscode.window.showInformationMessage(
        `Val email address copied to clipboard`
      );
    }),
    vscode.commands.registerCommand("valtown.open", async (arg) => {
      const valID = extractValID(arg);

      const val = await client.getVal(valID);
      return vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          `val://${val.id}/${val.author?.username?.slice(1)}/${
            val.name
          }/mod.tsx`
        )
      );
    }),
    vscode.commands.registerCommand("valtown.diff", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      const versions = await client.listVersions(valID);
      if (versions.length < 2) {
        vscode.window.showErrorMessage("Val has no previous versions");
        return;
      }
      const pick = await vscode.window.showQuickPick<
        { version: number } & vscode.QuickPickItem
      >(
        versions.slice(1).map((version) => ({
          label: `v${version.version}`,
          description: new Date(version.runStartAt).toLocaleString(),
          version: version.version,
        })),
        { title: "Select a version to open" }
      );
      if (!pick) {
        return;
      }

      return vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.parse(
          `val://${val.id}/${val.author?.username?.slice(1)}/${val.name}@${
            pick.version
          }/mod.tsx`
        ),
        vscode.Uri.parse(
          `val://${val.id}/${val.author?.username?.slice(1)}/${
            val.name
          }@/mod.tsx`
        )
      );
    }),
    vscode.commands.registerCommand("valtown.quickOpen", async () => {
      const vals = await client.listMyVals();
      const pick = await vscode.window.showQuickPick<
        { id: string } & vscode.QuickPickItem
      >(
        vals.map((val) => ({
          id: val.id,
          label: `$(${valIcon(val.privacy).id}) ${val.name}`,
          description: `v${val.version}`,
        })),
        { title: "Select a val to open" }
      );
      if (!pick) {
        return;
      }

      const val = await client.getVal(pick.id);
      return vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          `val://${val.id}/${val.author?.username?.slice(1)}/${
            val.name
          }/mod.tsx`
        )
      );
    })
  );
}
