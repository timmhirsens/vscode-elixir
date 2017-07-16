import * as vscode from 'vscode';
import { configuration } from './configuration';
<<<<<<< 693cdcdf19d86a62ba590fe8b2ab08625cc85b99
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHoverProvider } from './elixirHoverProvider';
=======
>>>>>>> renamed configuration.ts, lint elixirMain.ts
import { ElixirSenseAutocompleteProvider } from './elixirSenseAutocompleteProvider';
import { ElixirSenseClient } from './elixirSenseClient';
import { ElixirSenseDefinitionProvider } from './elixirSenseDefinitionProvider';
import { ElixirSenseHoverProvider } from './elixirSenseHoverProvider';
<<<<<<< 693cdcdf19d86a62ba590fe8b2ab08625cc85b99
=======
// Elixir-Sense
>>>>>>> renamed configuration.ts, lint elixirMain.ts
import { ElixirSenseServerProcess } from './elixirSenseServerProcess';
import { ElixirSenseSignatureHelpProvider } from './elixirSenseSignatureHelpProvider';
import { ElixirServer } from './elixirServer';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
<<<<<<< 693cdcdf19d86a62ba590fe8b2ab08625cc85b99
// tslint:disable-next-line:prefer-const
let elixirServer: ElixirServer;
// Elixir-Sense
let useElixirSense: boolean;
=======
// Elixir-Sense
>>>>>>> renamed configuration.ts, lint elixirMain.ts
let elixirSenseServer: ElixirSenseServerProcess;
let elixirSenseClient: ElixirSenseClient;

export function activate(ctx: vscode.ExtensionContext) {
    const elixirSetting = vscode.workspace.getConfiguration('elixir');
<<<<<<< 693cdcdf19d86a62ba590fe8b2ab08625cc85b99
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
            ctx.subscriptions.concat([
                vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, autoCompleteProvider, '.', '{', '@'),
                vscode.languages.registerDefinitionProvider(ELIXIR_MODE, definitionProvider),
                vscode.languages.registerHoverProvider(ELIXIR_MODE, hoverProvider),
                vscode.languages.registerSignatureHelpProvider(ELIXIR_MODE, signatureHelpProvider, '(', ','),
                vscode.languages.setLanguageConfiguration('elixir', configuration)
            ]);
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
=======

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
>>>>>>> renamed configuration.ts, lint elixirMain.ts
}

export function deactivate() {
    elixirSenseServer.stop();
}
