import * as vscode from 'vscode';
import { configuration } from './configuration';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHoverProvider } from './elixirHoverProvider';
import { ElixirSenseAutocompleteProvider } from './elixirSenseAutocompleteProvider';
import { ElixirSenseClient } from './elixirSenseClient';
import { ElixirSenseDefinitionProvider } from './elixirSenseDefinitionProvider';
import { ElixirSenseHoverProvider } from './elixirSenseHoverProvider';
import { ElixirSenseServerProcess } from './elixirSenseServerProcess';
import { ElixirSenseSignatureHelpProvider } from './elixirSenseSignatureHelpProvider';
import { ElixirServer } from './elixirServer';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
// tslint:disable-next-line:prefer-const
let elixirServer: ElixirServer;
// Elixir-Sense
let useElixirSense: boolean;
let elixirSenseServer: ElixirSenseServerProcess;
let elixirSenseClient: ElixirSenseClient;

export function activate(ctx: vscode.ExtensionContext) {
    const elixirSetting = vscode.workspace.getConfiguration('elixir');
    useElixirSense = elixirSetting.useElixirSense;

    if (useElixirSense) {
        ElixirSenseServerProcess.initClass();
        // TODO: detect environment automatically.
        const env = elixirSetting.elixirEnv;
        const projectPath = vscode.workspace.rootPath;
        elixirSenseServer = new ElixirSenseServerProcess(vscode.workspace.rootPath, (host, port, authToken) => {
            elixirSenseClient = new ElixirSenseClient(host, port, authToken, env, projectPath);
            const autoCompleteProvider = new ElixirSenseAutocompleteProvider(elixirSenseClient);
            const definitionProvider = new ElixirSenseDefinitionProvider(elixirSenseClient);
            const hoverProvider = new ElixirSenseHoverProvider(elixirSenseClient);
            const signatureHelpProvider = new ElixirSenseSignatureHelpProvider(elixirSenseClient);
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
