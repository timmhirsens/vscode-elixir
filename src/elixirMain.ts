import { existsSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { configuration } from './configuration';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirDocumentSymbolProvider } from './elixirDocumentSymbolProvider';
import { ElixirFormatterProvider } from './elixirFormatter';
import { ElixirHoverProvider } from './elixirHoverProvider';
import { ElixirReferenceProvider } from './elixirReferenceProvider';
import { ElixirSenseAutocompleteProvider } from './elixirSenseAutocompleteProvider';
import { ElixirSenseClient } from './elixirSenseClient';
import { ElixirSenseDefinitionProvider } from './elixirSenseDefinitionProvider';
import { ElixirSenseHoverProvider } from './elixirSenseHoverProvider';
import { ElixirSenseServerProcess } from './elixirSenseServerProcess';
import { ElixirSenseSignatureHelpProvider } from './elixirSenseSignatureHelpProvider';
import { ElixirServer } from './elixirServer';
import { ElixirWorkspaceSymbolProvider } from './elixirWorkspaceSymbolProvider';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
// tslint:disable-next-line:prefer-const
let elixirServer: ElixirServer;
// Elixir-Sense
let useElixirSense: boolean;
let autoSpawnElixirSenseServers: boolean;
const elixirSenseServers: { [path: string]: { server: ElixirSenseServerProcess; subscriptions: () => vscode.Disposable[] } } = {};
const elixirSenseClients: { [path: string]: ElixirSenseClient } = {};

export function activate(ctx: vscode.ExtensionContext) {
  const elixirSetting = vscode.workspace.getConfiguration('elixir');
  useElixirSense = elixirSetting.useElixirSense;
  autoSpawnElixirSenseServers = elixirSetting.autoSpawnElixirSenseServers;
  const projectPath = elixirSetting.projectPath;
  // TODO: detect environment automatically.
  const env = elixirSetting.elixirEnv;

  if (useElixirSense) {
    ElixirSenseServerProcess.initClass();
    if (autoSpawnElixirSenseServers) {
      (vscode.workspace.workspaceFolders || []).forEach(workspaceFolder => {
        startElixirSenseServerForWorkspaceFolder(workspaceFolder, ctx, env, projectPath);
      });
    } else if ((vscode.workspace.workspaceFolders || []).length === 1) {
      startElixirSenseServerForWorkspaceFolder(vscode.workspace.workspaceFolders[0], ctx, env);
    }
    vscode.workspace.onDidChangeWorkspaceFolders(e => {
      (e.removed || []).forEach(workspaceFolder => stopElixirSenseServerByPath(workspaceFolder.uri.fsPath));
      if (autoSpawnElixirSenseServers) {
        (e.added || []).forEach(workspaceFolder => startElixirSenseServerForWorkspaceFolder(workspaceFolder, ctx, env));
      }
    });
  } else {
    this.elixirServer = new ElixirServer(elixirSetting.command);
    this.elixirServer.start();
    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirAutocomplete(this.elixirServer), '.'));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirDefinitionProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELIXIR_MODE, new ElixirHoverProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(ELIXIR_MODE, new ElixirFormatterProvider()));
    ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));
  }

  ctx.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(ELIXIR_MODE, new ElixirDocumentSymbolProvider()));
  ctx.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new ElixirWorkspaceSymbolProvider()));
  ctx.subscriptions.push(vscode.languages.registerReferenceProvider(ELIXIR_MODE, new ElixirReferenceProvider()));

  const disposables = [];
  if (useElixirSense) {
    disposables.push(vscode.commands.registerCommand('extension.selectElixirSenseWorkspaceFolder', () => selectElixirSenseWorkspaceFolder(ctx, env)));
  }
  ctx.subscriptions.push(...disposables);
}

export function deactivate() {
  if (useElixirSense) {
    stopAllElixirSenseServers();
  } else {
    this.elixirServer.stop();
  }
}

function startElixirSenseServerForWorkspaceFolder(workspaceFolder: vscode.WorkspaceFolder, ctx: vscode.ExtensionContext, env: any, settingProjectPath = '') {
  const projectPath = join(workspaceFolder.uri.fsPath, settingProjectPath);
  if (elixirSenseServers[projectPath] || !existsSync(join(projectPath, 'mix.exs'))) {
    const warnmsg = `Could not find a Mix project in ${projectPath}. Elixir support disabled. `;
    const hint = `If your Mix project is in a subfolder, change the elixir.projectPath setting accordingly.`;
    vscode.window.showWarningMessage(warnmsg + hint);
    return;
  }
  let subscriptions;
  const elixirSetting = vscode.workspace.getConfiguration('elixir');
  const elixirSenseServer = new ElixirSenseServerProcess(elixirSetting.command, projectPath, (host, port, authToken) => {
    const elixirSenseClient = new ElixirSenseClient(host, port, authToken, env, projectPath);
    elixirSenseClients[projectPath] = elixirSenseClient;
    const autoCompleteProvider = new ElixirSenseAutocompleteProvider(elixirSenseClient);
    const definitionProvider = new ElixirSenseDefinitionProvider(elixirSenseClient);
    const hoverProvider = new ElixirSenseHoverProvider(elixirSenseClient);
    const signatureHelpProvider = new ElixirSenseSignatureHelpProvider(elixirSenseClient);
    const elixirFormatterProvider = new ElixirFormatterProvider();
    subscriptions = [
      vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, autoCompleteProvider, '.', '{', '@'),
      vscode.languages.registerDefinitionProvider(ELIXIR_MODE, definitionProvider),
      vscode.languages.registerHoverProvider(ELIXIR_MODE, hoverProvider),
      vscode.languages.registerSignatureHelpProvider(ELIXIR_MODE, signatureHelpProvider, '(', ','),
      vscode.languages.registerDocumentFormattingEditProvider(ELIXIR_MODE, elixirFormatterProvider),
      vscode.languages.setLanguageConfiguration('elixir', configuration)
    ];
    ctx.subscriptions.concat(subscriptions);
  });
  elixirSenseServer.start(0, env);
  elixirSenseServers[projectPath] = {
    server: elixirSenseServer,
    subscriptions: () => subscriptions
  };
}

function stopElixirSenseServerByPath(path: string) {
  const serverEntry = elixirSenseServers[path];
  if (serverEntry) {
    serverEntry.server.stop();
    (serverEntry.subscriptions() || []).forEach(subscription => subscription.dispose());
  }
  delete elixirSenseServers[path];
}

function stopAllElixirSenseServers() {
  Object.keys(elixirSenseServers).forEach(stopElixirSenseServerByPath);
}

function selectElixirSenseWorkspaceFolder(ctx: vscode.ExtensionContext, env: any) {
  if (autoSpawnElixirSenseServers) {
    vscode.window.showInformationMessage(
      'Setting `elixir.autoSpawnElixirSenseServers` is set to `true`' + 'so there is no need to manually start the ElixirSense server'
    );
    return;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  if (!workspaceFolders.length) {
    vscode.window.showInformationMessage('There are no folders in the current workspace');
    return;
  }
  const items = workspaceFolders
    .map(
      workspaceFolder =>
        ({
          label: workspaceFolder.name,
          description: workspaceFolder.uri.fsPath
        } as vscode.QuickPickItem)
    )
    .filter(item => !elixirSenseServers[item.description]);
  const options = {
    matchOnDescription: false,
    matchOnDetail: false,
    placeHolder: 'Choose workspace folder...'
  } as vscode.QuickPickOptions;
  vscode.window.showQuickPick(items, options).then(
    (item: vscode.QuickPickItem) => {
      if (!item) {
        return;
      }
      const workspaceFolder = (vscode.workspace.workspaceFolders || []).find(workspaceFolderTmp => workspaceFolderTmp.uri.fsPath === item.description);
      if (!workspaceFolder) {
        return;
      }
      stopAllElixirSenseServers();
      startElixirSenseServerForWorkspaceFolder(workspaceFolder, ctx, env);
    },
    // tslint:disable-next-line:no-empty
    (reason: any) => {}
  );
}
