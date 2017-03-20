import * as vscode from 'vscode';
import { ElixirAutocomplete } from './elixirAutocomplete';
import { ElixirServer } from './elixirServer';
import { ElixirDefinitionProvider } from './elixirDefinitionProvider';
import { ElixirHighlightProvider } from './elixirHighlightProvider';
import {configuration} from './elixirConfiguration';

const ELIXIR_MODE: vscode.DocumentFilter = { language: 'elixir', scheme: 'file' };
let elixirServer: ElixirServer;

export function activate(ctx: vscode.ExtensionContext) {
    this.elixirServer = new ElixirServer();
    const elixirHighlightProvider = new ElixirHighlightProvider();
    this.elixirServer.start();
    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(ELIXIR_MODE, new ElixirAutocomplete(this.elixirServer), '.'));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELIXIR_MODE, new ElixirDefinitionProvider(this.elixirServer)));
    ctx.subscriptions.push(vscode.languages.setLanguageConfiguration('elixir', configuration));
    ctx.subscriptions.push(vscode.languages.registerDocumentHighlightProvider('elixir', elixirHighlightProvider));
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(elixirHighlightProvider.balanceEvent.bind(elixirHighlightProvider)));
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(elixirHighlightProvider.balanceEvent.bind(elixirHighlightProvider)));
    ctx.subscriptions.push(vscode.workspace.onDidOpenTextDocument(elixirHighlightProvider.balanceEvent.bind(elixirHighlightProvider)));
    if (vscode.window && vscode.window.activeTextEditor) {
        elixirHighlightProvider.balancePairs(vscode.window.activeTextEditor.document);
    }

}

export function deactivate() {
    this.elixirServer.stop();
}
