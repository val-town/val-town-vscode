import * as vscode from "vscode";
import * as ts from "typescript";
import { CompletionVal } from "./client";

const tsNodeToRange = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): vscode.Range => {
  const positionOfNode = (startOrEnd: number): vscode.Position => {
    const position = sourceFile.getLineAndCharacterOfPosition(startOrEnd);
    return new vscode.Position(position.line, position.character);
  };

  return new vscode.Range(
    positionOfNode(node.getStart()),
    positionOfNode(node.getEnd())
  );
};

enum UpgradeBehavior {
  Prompt = "prompt",
  Upgrade = "upgrade",
  Nothing = "nothing",
}

export default async (
  completionVal: CompletionVal,
  // the command writes the imported keyword to this range.
  // relevant when importing { exportedName as keyword }
  keywordRange?: vscode.Range,
  forceUpgradeBehavior?: UpgradeBehavior
) => {
  const { handle, name, exportedName, version } = completionVal;
  const config = vscode.workspace.getConfiguration("valtown.autoImport");
  const staticVersion = config.get<boolean>("staticVersion", false);
  const showUpgradeNotifications = config.get<boolean>(
    "showUpgradeNotifications",
    true
  );
  const ugpradeBehavior =
    forceUpgradeBehavior ??
    config.get<UpgradeBehavior>("upgradeBehavior", UpgradeBehavior.Prompt);

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = editor.document;
  const text = document.getText();

  const importURL = `https://esm.town/v/${handle}/${name}`;

  const sourceFile = ts.createSourceFile(
    document.fileName,
    text,
    ts.ScriptTarget.ES2015,
    true
  );

  // this represents the actions we want to execute
  let result: {
    // the import statement to add
    statement: string;
    // where to add the import statement
    range: vscode.Range;
    // the imported keyword
    keyword: string;
  } | null = null;

  // if we aren't able to modify an existing import,
  // we'll add the new import after the last static import we find
  let lastStaticImport: ts.ImportDeclaration | null = null;

  function visit(node: ts.Node) {
    // if we already found our import, we can stop checking
    if (result !== null) {
      return;
    }

    // ignore non-import nodes
    if (!ts.isImportDeclaration(node)) {
      return;
    }

    const existingImportURL = new URL(
      node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "")
    );

    const existingVersion = existingImportURL.searchParams.get("v");
    const existingImportURLWithoutVersion = new URL(
      existingImportURL.toString()
    );
    existingImportURLWithoutVersion.searchParams.delete("v");

    // see if importURLs match, ignoring version
    if (existingImportURLWithoutVersion.toString() !== importURL) {
      lastStaticImport = node;
      return;
    }

    const newImportURL = new URL(existingImportURLWithoutVersion.toString());

    // upgrade url behavior
    let message: string | null = null;
    const actions: Record<string, () => void> = {};
    let useDisableNotifications = false;
    if (existingVersion === null) {
      if (staticVersion) {
        newImportURL.searchParams.set("v", version.toString());
        message = `Froze existing import of ${handle}/${name} at v${version}`;
        useDisableNotifications = true;
      }
    } else if (existingVersion !== version.toString()) {
      if (ugpradeBehavior === UpgradeBehavior.Upgrade) {
        newImportURL.searchParams.set("v", version.toString());
        message = `Upgraded existing v${existingVersion} import of ${handle}/${name} to v${version}`;
        useDisableNotifications = true;
      } else if (ugpradeBehavior === UpgradeBehavior.Prompt) {
        // keep existing version until user decides
        newImportURL.searchParams.set("v", existingVersion);
        message = `Upgrade to latest v${version} of ${handle}/${name}?`;
        actions["Yes"] = () => {
          // just call this command again with force-upgrade
          vscode.commands.executeCommand(
            "valtown.importVal",
            completionVal,
            undefined,
            UpgradeBehavior.Upgrade
          );
        };
        actions["No"] = () => {};
        actions["Always"] = () => {
          actions["Yes"]();
          config.update("upgradeBehavior", UpgradeBehavior.Upgrade, true);
        };
        actions["Never"] = () => {
          actions["No"]();
          config.update("upgradeBehavior", UpgradeBehavior.Nothing, true);
        };
      }
    }
    actions["Settings"] = () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "valtown.autoImport"
      );
    };
    if (useDisableNotifications) {
      actions["Disable Notifications"] = () => {
        config.update("showUpgradeNotifications", false, true);
      };
    }

    if (
      message !== null &&
      (ugpradeBehavior === UpgradeBehavior.Prompt || showUpgradeNotifications)
    ) {
      vscode.window
        .showInformationMessage(message, ...Object.keys(actions))
        .then((action) => {
          if (action !== undefined) {
            actions[action]();
          }
        });
    }

    const importClause = node.importClause;
    const defaultImport = importClause?.name;
    const namedImports = importClause?.namedBindings as
      | ts.NamedImports
      | undefined;

    const matchingNamedImport = namedImports?.elements.find(
      (e) => (e.propertyName ?? e.name).getText() === exportedName
    );

    // case 1: import has what we need, do nothing
    if (
      exportedName === null ||
      (defaultImport !== undefined && exportedName === "default") ||
      matchingNamedImport
    ) {
      result = {
        statement: `import ${node.importClause!.getText()} from '${newImportURL.toString()}';`,
        range: tsNodeToRange(node, sourceFile),
        keyword:
          exportedName === "default"
            ? defaultImport!.getText()
            : matchingNamedImport!.name.getText(),
      };
      return;
    }

    // case 2: we need to add the default import
    if (exportedName === "default") {
      let statement = `import ${name}`;
      if (namedImports) {
        statement += `, ${namedImports.getText()}`;
      }
      statement += ` from '${newImportURL}';`;
      result = {
        statement,
        range: tsNodeToRange(node, sourceFile),
        keyword: name,
      };
      return;
    }

    // case 3: we need to add the named import
    let statement = "import ";
    if (defaultImport) {
      statement += `${defaultImport.getText()}, `;
    }
    statement += "{ ";
    if (namedImports) {
      statement +=
        namedImports.elements.map((e) => e.getText()).join(", ") + ", ";
    }
    statement += `${exportedName} } from '${newImportURL}';`;

    result = {
      statement,
      range: tsNodeToRange(node, sourceFile),
      keyword: exportedName,
    };
  }

  ts.forEachChild(sourceFile, visit);

  // ts doesn't realize that lastStaticImport may have been set in the loop
  lastStaticImport = lastStaticImport as ts.ImportDeclaration | null;

  // case 4: we need to add a whole new import
  if (result === null) {
    // try to put the new import after the last static import,
    // or at the top of the file if there are no static imports
    let nextLine;
    if (lastStaticImport !== null) {
      nextLine = new vscode.Position(
        sourceFile.getLineAndCharacterOfPosition(lastStaticImport.getEnd())
          .line + 1,
        0
      );
    } else {
      nextLine = new vscode.Position(0, 0);
    }

    let statement = "import ";
    if (exportedName === "default") {
      statement += `${name} from `;
    } else if (exportedName !== null) {
      statement += `{ ${exportedName} } from `;
    }
    statement += `'${importURL}`;
    if (staticVersion) {
      statement += `?v=${version}`;
    }
    statement += "';\n";
    result = {
      statement,
      range: new vscode.Range(nextLine, nextLine),
      keyword: exportedName === "default" ? name : exportedName,
    };
  }

  editor.edit(
    (editBuilder) => {
      if (result === null) {
        return;
      }
      editBuilder.replace(result.range, result.statement);
      if (keywordRange !== undefined) {
        editBuilder.replace(keywordRange, result.keyword);
      }
    },
    { undoStopBefore: false, undoStopAfter: true }
  );
};
