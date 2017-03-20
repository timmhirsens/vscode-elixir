import * as vscode from 'vscode';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirServer } from './elixirServer';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHoverProvider } from './elixirHoverProvider';
import {configuration} from './elixirConfiguration';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
let elixirServer: ElixirServer;

export function activate(ctx: vscode.ExtensionContext) {
    this.elixirServer = new ElixirServer();
    this.elixirServer.start();
    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirAutocomplete(this.elixirServer), '.'));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirDefinitionProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.registerHoverProvider(ELIXIR_MODE, new ElixirHoverProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));
}

export function deactivate() {
    this.elixirServer.stop();
}
