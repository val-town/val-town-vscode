import * as vscode from "vscode";
import { clearToken, saveToken } from "./secrets";
import { ValTemplate, ValtownClient } from "./client";
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
      const template = await vscode.window.showQuickPick<
        vscode.QuickPickItem & { value?: ValTemplate }
      >(
        [
          { label: "New val" },
          {
            label: "HTTP handler",
            value: "http",
          },
          {
            label: "Scheduled function",
            value: "cron",
          },
          {
            label: "Email handler",
            value: "email",
          },
        ],
        {
          title: "Select a template",
        }
      );
      if (!template) {
        return;
      }

      const val = await client.createVal(template.value);
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
    vscode.commands.registerCommand("valtown.rename", async (arg) => {
      const valID = extractValID(arg);

      const val = await client.getVal(valID);
      const name = await vscode.window.showInputBox({
        prompt: "Val name",
        value: val.name,
        validateInput: async (value) => {
          if (!value) {
            return "Val name cannot be empty";
          }
        },
      });

      if (!name) {
        return;
      }

      await client.renameVal(valID, name);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setPrivacy", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      const privacy = await vscode.window.showQuickPick<
        vscode.QuickPickItem & {
          value: "public" | "unlisted" | "private";
        }
      >(
        [
          {
            label: "Public",
            description: "Anyone can see and run this val",
            value: "public",
          },
          {
            label: "Unlisted",
            description: "Anyone with the link can see and run this val",
            value: "unlisted",
          },
          {
            label: "Private",
            description: "Only you can see and run this val",
            value: "private",
          },
        ],
        { title: "Select val privacy" }
      );

      if (!privacy || privacy.value == val.privacy) {
        return;
      }

      await client.setPrivacy(valID, privacy.value);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setPublic", async (arg) => {
      const valID = extractValID(arg);
      await client.setPrivacy(valID, "public");
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setUnlisted", async (arg) => {
      const valID = extractValID(arg);
      await client.setPrivacy(valID, "unlisted");
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setPrivate", async (arg) => {
      const valID = extractValID(arg);
      await client.setPrivacy(valID, "private");
      await vscode.commands.executeCommand("valtown.refresh");
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
    vscode.commands.registerCommand("valtown.copyModuleURL", async (arg) => {
      const valID = extractValID(arg);

      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://esm.town/v/${val.author.username.slice(1)}/${val.name}`
      );
      vscode.window.showInformationMessage(`Module URL copied to clipboard`);
    }),
    vscode.commands.registerCommand("copyValID", async (arg) => {
      const valID = extractValID(arg);

      vscode.env.clipboard.writeText(valID);
      vscode.window.showInformationMessage(`Val ID copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.deleteVal", async (arg) => {
      const valID = extractValID(arg);

      await client.deleteVal(valID);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.copyValUrl", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`
      );
      vscode.window.showInformationMessage(`Val link copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openValUrl", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      await vscode.env.openExternal(
        vscode.Uri.parse(
          `https://val.town/v/${val.author?.username?.slice(1)}/${val.name}`
        )
      );
    }),
    vscode.commands.registerCommand("valtown.copyScriptTag", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `<script type="module" src="https://esm.town/v/${val.author?.username?.slice(
          1
        )}/${val.name}"></script>`
      );
      vscode.window.showInformationMessage(`Script tag copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.copyEmailAddress", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `${val.author?.username?.slice(1)}.${val.name}@valtown.email`
      );
      vscode.window.showInformationMessage(`Email Address copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openValLogs", async (arg) => {
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
    vscode.commands.registerCommand("valtown.copyEmbedUrl", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://val.town/embed/${val.author?.username?.slice(1)}.${val.name}`
      );
      vscode.window.showInformationMessage(`Embed URL to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.copyHttpEndpoint", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.clipboard.writeText(
        `https://${val.author.username.slice(1)}-${val.name}.web.val.run`
      );
      vscode.window.showInformationMessage(
        `Val HTTP endpoint copied to clipboard`
      );
    }),
    vscode.commands.registerCommand("valtown.openHttpEndpoint", async (arg) => {
      const valID = extractValID(arg);
      const val = await client.getVal(valID);
      vscode.env.openExternal(
        vscode.Uri.parse(
          `https://${val.author.username.slice(1)}-${val.name}.web.val.run`
        )
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
          label: `\$(${valIcon(val.privacy).id}) ${val.name}`,
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
