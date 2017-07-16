import * as vscode from 'vscode';
import { configuration } from './configuration';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHoverProvider } from './elixirHoverProvider';
import { ElixirSenseAutocompleteProvider } from './elixirSenseAutocompleteProvider';
import { ElixirSenseClient } from './elixirSenseClient';
import { ElixirSenseDefinitionProvider } from './elixirSenseDefinitionProvider';
import { ElixirSenseHoverProvider } from './elixirSenseHoverProvider';
// Elixir-Sense
import { ElixirSenseServerProcess } from './elixirSenseServerProcess';
import { ElixirSenseSignatureHelpProvider } from './elixirSenseSignatureHelpProvider';
import { ElixirServer } from './elixirServer';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
// Elixir-Sense
let elixirSenseServer: ElixirSenseServerProcess;
let elixirSenseClient: ElixirSenseClient;

export function activate(ctx: vscode.ExtensionContext) {
    const elixirSetting = vscode.workspace.getConfiguration('elixir');

    // TODO: detect environment automatically.
    const env = elixirSetting.elixirEnv;
    const projectPath = vscode.workspace.rootPath;
    elixirSenseServer = new ElixirSenseServerProcess(vscode.workspace.rootPath, (host, port, authToken) => {
        console.log('host ', host);
        console.log('host ', port);
        console.log('host ', authToken);
        elixirSenseClient = new ElixirSenseClient(host, port, authToken, env, projectPath);
        const autoCompleteProvider = new ElixirSenseAutocompleteProvider(elixirSenseClient);
        const definitionProvider = new ElixirSenseDefinitionProvider(elixirSenseClient);
        const hoverProvider = new ElixirSenseHoverProvider(elixirSenseClient);
        const signatureHelpProvider = new ElixirSenseSignatureHelpProvider(elixirSenseClient);
        ctx.subscriptions.concat([
            vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, autoCompleteProvider, '.', '{', '@'),
            vscode.languages.registerDefinitionProvider(ELIXIR_MODE, definitionProvider),
            vscode.languages.registerHoverProvider(ELIXIR_MODE, hoverProvider),
            vscode.languages.registerSignatureHelpProvider(ELIXIR_MODE, signatureHelpProvider, '(', ','),
            vscode.languages.setLanguageConfiguration('elixir', configuration)
        ]);
    });
    elixirSenseServer.start(0, env);
}

export function deactivate() {
    elixirSenseServer.stop();
}
