import * as vscode from "vscode";
import { clearToken, saveToken } from "./secrets";
import { BaseVal, ValTemplate, ValtownClient } from "./client";

export function registerCommands(
  context: vscode.ExtensionContext,
  client: ValtownClient,
) {
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
      },
    ),
    vscode.commands.registerCommand("valtown.clearToken", async () => {
      await clearToken(context);
    }),
    vscode.commands.registerCommand("valtown.createVal", async () => {
      const val = await client.createVal();
      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          `vt+val:/${val.author.username.slice(1)}/${val.name}.tsx`,
        ),
      );

      vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand(
      "valtown.createValFromTemplate",
      async () => {
        const template = await vscode.window.showQuickPick<
          vscode.QuickPickItem & { value: ValTemplate }
        >(
          [
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
          },
        );
        if (!template) {
          return;
        }

        const val = await client.createVal({
          template: template.value,
          privacy: template.value === "cron" ? "private" : "unlisted",
        });
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse(
            `vt+val:/${val.author.username.slice(1)}/${val.name}.tsx`,
          ),
        );
        vscode.commands.executeCommand("valtown.refresh");
      },
    ),
    vscode.commands.registerCommand("valtown.rename", async (arg) => {
      const { val } = arg;
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

      const oldURI = vscode.Uri.parse(
        `vt+val:/${val.author.username.slice(1)}/${val.name}.tsx`,
      );
      const newURI = vscode.Uri.parse(
        `vt+val:/${val.author.username.slice(1)}/${name}.tsx`,
      );

      vscode.workspace.fs.rename(oldURI, newURI, { overwrite: false });
    }),
    vscode.commands.registerCommand("valtown.setPrivacy", async (arg) => {
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
        { title: "Select val privacy" },
      );

      if (!privacy || privacy.value == arg.val.privacy) {
        return;
      }

      await client.setPrivacy(arg.val.id, privacy.value);
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setPublic", async (arg) => {
      await client.setPrivacy(arg.val.id, "public");
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setUnlisted", async (arg) => {
      await client.setPrivacy(arg.val.id, "unlisted");
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.setPrivate", async (arg) => {
      await client.setPrivacy(arg.val.id, "private");
      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.copyModuleURL", async (arg) => {
      const { name, author } = arg.val;
      vscode.env.clipboard.writeText(
        `https://esm.town/v/${author.username.slice(1)}/${name}`,
      );
      vscode.window.showInformationMessage(`Module URL copied to clipboard`);
    }),
    vscode.commands.registerCommand("copyValID", async (arg) => {
      vscode.env.clipboard.writeText(arg.val.id);
      vscode.window.showInformationMessage(`Val ID copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.deleteVal", async (arg) => {
      const { author, name } = arg.val as BaseVal;

      vscode.workspace.fs.delete(
        vscode.Uri.parse(`vt+val:/${author.username.slice(1)}/${name}.tsx`),
      );

      await vscode.commands.executeCommand("valtown.refresh");
    }),
    vscode.commands.registerCommand("valtown.copyValUrl", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.clipboard.writeText(
        `https://val.town/v/${author.username.slice(1)}/${name}`,
      );
      vscode.window.showInformationMessage(`Val link copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openValUrl", async (arg) => {
      let valUrl: string;
      if ("val" in arg) {
        const { author, name } = arg.val;
        valUrl = `https://val.town/v/${author.username.slice(1)}/${name}`;
      } else {
        const [author, filename] = arg.path.slice(1).split("/");
        valUrl = `https://val.town/v/${author}/${filename.split(".")[0]}`;
      }

      await vscode.env.openExternal(vscode.Uri.parse(valUrl));
    }),
    vscode.commands.registerCommand("valtown.copyScriptTag", async (arg) => {
      const { author, name } = arg.val;
      // prettier-ignore
      vscode.env.clipboard.writeText(
        `<script type="module" src="https://val.town/v/${
          author.username.slice(1)
        }/${name}"></script>`,
      );
      vscode.window.showInformationMessage(`Script tag copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.copyEmailAddress", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.clipboard.writeText(
        `${author.username.slice(1)}.${name}@valtown.email`,
      );
      vscode.window.showInformationMessage(`Email Address copied to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.openValLogs", async (arg) => {
      const { author, name } = arg.val;
      await vscode.env.openExternal(
        vscode.Uri.parse(
          `https://val.town/v/${
            author?.username?.slice(1)
          }/${name}/evaluations`,
        ),
      );
    }),
    vscode.commands.registerCommand("valtown.copyEmbedUrl", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.clipboard.writeText(
        `https://val.town/embed/${author.username.slice(1)}.${name}`,
      );
      vscode.window.showInformationMessage(`Embed URL to clipboard`);
    }),
    vscode.commands.registerCommand("valtown.copyHttpEndpoint", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.clipboard.writeText(
        `https://${author.username.slice(1)}-${name}.web.val.run`,
      );
      vscode.window.showInformationMessage(
        `Val HTTP endpoint copied to clipboard`,
      );
    }),
    vscode.commands.registerCommand("valtown.openHttpEndpoint", async (arg) => {
      const { author, name } = arg.val;
      vscode.env.openExternal(
        vscode.Uri.parse(
          `https://${author.username.slice(1)}-${name}.web.val.run`,
        ),
      );
    }),
    vscode.commands.registerCommand("valtown.open", async () => {
      const slugRegex = /^@[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/;
      const urlRegex =
        /^https:\/\/val\.town\/v\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/;
      const valSlug = await vscode.window.showInputBox({
        prompt: "Val slug",
        placeHolder: "@stevekouse/fetchJSON",
        validateInput: async (value) => {
          if (!slugRegex.test(value || "") && !urlRegex.test(value || "")) {
            return "Invalid val name";
          }
        },
      });

      if (!valSlug) {
        return;
      }
      let valUri: vscode.Uri;
      if (valSlug.startsWith("@")) {
        valUri = vscode.Uri.parse(`vt+val:/${valSlug.slice(1)}.tsx`);
      } else {
        const [, author, name] = new URL(valSlug).pathname.split("/");
        valUri = vscode.Uri.parse(`vt+val:/${author}/${name}.tsx`);
      }
      vscode.commands.executeCommand("vscode.open", valUri);
    }),
    vscode.commands.registerCommand(
      "valtown.openPreviewToSide",
      async (arg) => {
        let httpEndpoint: string;
        if ("val" in arg) {
          const { author, name } = arg.val;
          httpEndpoint = `https://${
            author.username.slice(1)
          }-${name}.web.val.run`;
        } else {
          const [author, filename] = arg.path.slice(1).split("/");
          httpEndpoint = `https://${author}-${
            filename.split(".")[0]
          }.web.val.run`;
        }
        vscode.commands.executeCommand(
          "simpleBrowser.api.open",
          httpEndpoint,
          {
            viewColumn: vscode.ViewColumn.Beside,
          },
        );
      },
    ),
    vscode.commands.registerCommand("valtown.openPreview", async (arg) => {
      let httpEndpoint: string;
      if ("val" in arg) {
        const { author, name } = arg.val;
        httpEndpoint = `https://${
          author.username.slice(1)
        }-${name}.web.val.run`;
      } else {
        const [author, filename] = arg.path.slice(1).split("/");
        httpEndpoint = `https://${author}-${
          filename.split(".")[0]
        }.web.val.run`;
      }
      vscode.commands.executeCommand(
        "simpleBrowser.api.open",
        httpEndpoint,
      );
    }),
  );
}
