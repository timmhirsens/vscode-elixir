import * as vscode from 'vscode';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirServer } from './elixirServer';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHoverProvider } from './elixirHoverProvider';
import { configuration } from './elixirConfiguration';
//Elixir-Sense
import { ElixirSenseServerProcess } from './elixirSenseServerProcess';
import { ElixirSenseClient } from './elixirSenseClient';
import { ElixirSenseAutocompleteProvider } from './elixirSenseAutocompleteProvider';
import { ElixirSenseDefinitionProvider } from './elixirSenseDefinitionProvider';
import { ElixirSenseHoverProvider } from './elixirSenseHoverProvider';
import { ElixirSenseSignatureHelpProvider } from './elixirSenseSignatureHelpProvider';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
let elixirServer: ElixirServer;
//Elixir-Sense
let useElixirSense: boolean;
let elixirSenseServer: ElixirSenseServerProcess;
let elixirSenseClient: ElixirSenseClient;


export function activate(ctx: vscode.ExtensionContext) {
    let elixirSetting = vscode.workspace.getConfiguration('elixir');
    useElixirSense = elixirSetting.useElixirSense;

    if (useElixirSense) {
        ElixirSenseServerProcess.initClass();
        //TODO: detect environment automatically.
        let env = elixirSetting.elixirEnv;
        let projectPath = vscode.workspace.rootPath;
        elixirSenseServer = new ElixirSenseServerProcess(vscode.workspace.rootPath, function (host, port, auth_token) {
            elixirSenseClient = new ElixirSenseClient(host, port, auth_token, env, projectPath);
            ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirSenseAutocompleteProvider(elixirSenseClient), '.', '{', '@'));
            ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirSenseDefinitionProvider(elixirSenseClient)));
            ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELIXIR_MODE, new ElixirSenseHoverProvider(elixirSenseClient)));
            ctx.subscriptions.push(vscode.languages.registerSignatureHelpProvider(ELIXIR_MODE, new ElixirSenseSignatureHelpProvider(elixirSenseClient), '('));
            ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));
        });
        elixirSenseServer.start(0, env);
    } else {
        this.elixirServer = new ElixirServer();
        this.elixirServer.start();
        ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirAutocomplete(this.elixirServer), '.'));
        ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirDefinitionProvider(this.elixirServer)));
        ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELIXIR_MODE, new ElixirHoverProvider(this.elixirServer)));
        ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));
    }
}

export function deactivate() {
    if (useElixirSense) {
        elixirSenseServer.stop();
    } else {
        this.elixirServer.stop();
    }
}
